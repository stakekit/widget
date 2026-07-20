import { Data, Duration, Effect, Option, Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { getValidStakeSessionTx } from "../../../domain";
import type { YieldAction } from "../../../domain/schema/action-models";
import type { ActionPreviewRequest } from "../../../services/api/yield-api-service";
import { YieldApiService } from "../../../services/api/yield-api-service";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../../earn/resources/yield-insights";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowIntakeVariant,
  getClassicTransactionFlowKycYield,
  getClassicTransactionWorkflowKey,
} from "../model/classic-transaction-flow";
import { makeClassicFlowSessionReviewResources } from "../resources/classic-flow-review-resources";
import type {
  ClassicFlowSession,
  ClassicFlowSessionStore,
} from "./classic-flow-session-store";
import { classicFlowSessionStore } from "./classic-flow-session-store";
import { makeClassicTransactionWorkflowFacade } from "./transaction-workflow-atoms";

type ClassicFlowSessionRuntime = Atom.AtomRuntime<
  TrackingService | YieldApiService
>;

export class ClassicFlowPreviewError extends Data.TaggedError(
  "ClassicFlowPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
}> {}

export class ClassicFlowInvalidExitPreviewError extends Data.TaggedError(
  "ClassicFlowInvalidExitPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: false;
}> {}

type ClassicFlowNavigation = "Review" | "Steps" | null;

type ClassicFlowSessionState = {
  readonly attachedAction: YieldAction | null;
  readonly navigation: ClassicFlowNavigation;
  readonly previewGeneration: number;
};

const getPreviewRequest = (
  intake: ClassicTransactionFlowIntake
): ActionPreviewRequest | null => {
  switch (intake._tag) {
    case "Enter":
      return { command: intake.request, intent: "enter" };
    case "Exit":
      return { command: intake.request, intent: "exit" };
    case "Manage":
      return { command: intake.request, intent: "manage" };
    case "ActivityResume":
      return null;
  }
};

export const makeClassicFlowSessionFacade = ({
  runtime,
  session,
  store,
}: {
  readonly runtime: ClassicFlowSessionRuntime;
  readonly session: ClassicFlowSession;
  readonly store: ClassicFlowSessionStore;
}) => {
  const initialState: ClassicFlowSessionState = {
    attachedAction:
      session.intake._tag === "ActivityResume" ? session.intake.action : null,
    navigation: null,
    previewGeneration: 0,
  };
  const stateAtom = Atom.make<ClassicFlowSessionState>(initialState).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(`classicFlowSessionState(${session.key})`)
  );
  const isCurrentSessionAtom = Atom.make(
    (get) => get(store.currentSessionAtom)?.key === session.key
  ).pipe(Atom.withLabel(`isCurrentClassicFlowSession(${session.key})`));
  const previewResourceAtom = Atom.family(
    (
      generation: number
    ): Atom.Atom<AsyncResult.AsyncResult<YieldAction | null, unknown>> => {
      const request = getPreviewRequest(session.intake);

      return request
        ? runtime
            .atom(
              YieldApiService.use((api) =>
                api.previewAction(request).pipe(
                  Effect.flatMap((action) => {
                    if (session.intake._tag !== "Exit") {
                      return Effect.succeed<YieldAction | null>(action);
                    }

                    const validation = getValidStakeSessionTx(action);
                    return Result.isFailure(validation)
                      ? Effect.fail(
                          new ClassicFlowInvalidExitPreviewError({
                            cause: validation.failure,
                            message:
                              "Classic Transaction Flow Exit preview is not executable.",
                            retryable: false,
                          })
                        )
                      : Effect.succeed<YieldAction | null>(validation.success);
                  }),
                  Effect.mapError((cause) =>
                    cause instanceof ClassicFlowInvalidExitPreviewError
                      ? cause
                      : new ClassicFlowPreviewError({
                          cause,
                          message:
                            "Classic Transaction Flow Action preview failed.",
                        })
                  )
                )
              ).pipe(Effect.withSpan("previewClassicFlowSessionAction"))
            )
            .pipe(
              withApiResourcePolicy({
                idleTTL: Duration.zero,
                revalidateOnMount: false,
                staleTime: Duration.infinity,
              }),
              Atom.withLabel(
                `classicFlowSessionPreview(${session.key}:${generation})`
              )
            )
        : Atom.make(
            AsyncResult.success<YieldAction | null, unknown>(null)
          ).pipe(Atom.setIdleTTL(0));
    }
  );
  const attachedActionAtom = Atom.make(
    (get) => get(stateAtom).attachedAction
  ).pipe(Atom.withLabel(`classicFlowSessionAction(${session.key})`));
  const intakeAtom = Atom.make(session.intake).pipe(
    Atom.withLabel(`classicFlowSessionIntake(${session.key})`)
  );
  const workflowKeyAtom = Atom.make((get) => {
    const action = get(attachedActionAtom);
    return action
      ? getClassicTransactionWorkflowKey(session.intake, action)
      : null;
  }).pipe(Atom.withLabel(`classicFlowSessionWorkflowKey(${session.key})`));
  const workflow = makeClassicTransactionWorkflowFacade(workflowKeyAtom);
  const kycGateAtom = Atom.make((get) =>
    get(
      currentYieldKycGateAtom(
        new CurrentYieldKycGateKey({
          enabled: true,
          yieldDto: getClassicTransactionFlowKycYield(get(intakeAtom)),
        })
      )
    )
  ).pipe(Atom.withLabel(`classicFlowSessionKycGate(${session.key})`));
  const refreshKycAtom = Atom.fnSync(
    (_input: undefined, get) => {
      get.set(
        refreshCurrentYieldKycAtom(
          new CurrentYieldKycGateKey({
            enabled: true,
            yieldDto: getClassicTransactionFlowKycYield(get(intakeAtom)),
          })
        ),
        undefined
      );
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("refreshClassicFlowSessionKycAtom"));
  const actionPreviewAtom = Atom.make((get) => {
    if (get(kycGateAtom).isGateBlocking) {
      return AsyncResult.success<YieldAction | null, ClassicFlowPreviewError>(
        null
      );
    }

    const state = get(stateAtom);
    return get(previewResourceAtom(state.previewGeneration));
  }).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(`classicFlowSessionActionPreview(${session.key})`)
  );
  const navigationAtom = Atom.make((get) =>
    get(isCurrentSessionAtom) ? get(stateAtom).navigation : null
  ).pipe(Atom.withLabel(`classicFlowSessionNavigation(${session.key})`));

  const continueAtom = Atom.fnSync((_input: undefined, context) => {
    const state = context(stateAtom);
    if (state.attachedAction) {
      context.set(stateAtom, { ...state, navigation: "Steps" });
      return;
    }

    const candidate = context(actionPreviewAtom).pipe(
      AsyncResult.value,
      Option.getOrNull
    );
    if (!candidate) return;

    context.set(stateAtom, {
      ...state,
      attachedAction: candidate,
      navigation: "Steps",
    });
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("continueClassicFlowSessionAtom"));

  const backAtom = Atom.fnSync((_input: undefined, context) => {
    const state = context(stateAtom);
    if (state.navigation === "Review" && state.attachedAction === null) return;

    const detachAction =
      session.intake._tag !== "ActivityResume" && state.attachedAction !== null;
    context.set(stateAtom, {
      attachedAction:
        session.intake._tag === "ActivityResume" ? session.intake.action : null,
      navigation: "Review",
      previewGeneration: detachAction
        ? state.previewGeneration + 1
        : state.previewGeneration,
    });
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("backClassicFlowSessionAtom"));

  const retryAtom = Atom.fnSync((_input: undefined, context) => {
    const error = context(actionPreviewAtom).pipe(
      AsyncResult.error,
      Option.getOrNull
    );
    if (!(error instanceof ClassicFlowPreviewError)) {
      return;
    }

    const state = context(stateAtom);
    context.set(stateAtom, {
      ...state,
      previewGeneration: state.previewGeneration + 1,
    });
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("retryClassicFlowSessionAtom"));

  const trackConfirmationAtom = runtime.fn(
    Effect.fn("trackClassicFlowSessionConfirmation")(function* (input: {
      readonly amount?: string;
      readonly yieldId: string;
    }) {
      const tracking = yield* TrackingService;
      yield* tracking.trackEvent("unstakeClicked", input);
    })
  );

  const confirmAtom = Atom.fnSync((_input: undefined, context) => {
    if (!context(isCurrentSessionAtom) || context(kycGateAtom).isGateBlocking) {
      return;
    }

    if (AsyncResult.isFailure(context(actionPreviewAtom))) {
      context.set(retryAtom, undefined);
      return;
    }

    if (session.intake._tag === "Exit") {
      context.set(trackConfirmationAtom, {
        yieldId: session.intake.integration.id,
        ...(session.intake.request.arguments?.amount
          ? { amount: session.intake.request.arguments.amount }
          : {}),
      });
    }

    context.set(continueAtom, undefined);
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("confirmClassicFlowSessionAtom"));

  const stepsRouteAtom = Atom.make((context) => {
    const state = context.once(stateAtom);
    if (state.navigation !== null) {
      context.set(stateAtom, { ...state, navigation: null });
    }
  }).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(`classicFlowSessionStepsRoute(${session.key})`)
  );

  const reviewRouteAtom = Atom.make((context) => {
    const state = context.once(stateAtom);
    const resetAction =
      session.intake._tag !== "ActivityResume" && state.attachedAction !== null;
    if (!resetAction && state.navigation === null) return;

    context.set(stateAtom, {
      attachedAction: resetAction ? null : state.attachedAction,
      navigation: null,
      previewGeneration: resetAction
        ? state.previewGeneration + 1
        : state.previewGeneration,
    });
  }).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(`classicFlowSessionReviewRoute(${session.key})`)
  );

  const runtimeLifecycleAtom = runtime
    .atom((context) =>
      Effect.acquireRelease(Effect.void, () =>
        Effect.sync(() => {
          context.set(store.clearAtom, session.key);
        })
      )
    )
    .pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel(`classicFlowSessionRuntimeLifecycle(${session.key})`)
    );

  const lifecycleAtom = Atom.make((context) => {
    context.once(stateAtom);
    context.once(runtimeLifecycleAtom);
    const registry = context.registry;

    context.addFinalizer(() => {
      registry.set(store.clearAtom, session.key);
    });
  }).pipe(
    Atom.setIdleTTL(0),
    Atom.withLabel(`classicFlowSessionLifecycle(${session.key})`)
  );

  const variantAtom = <Variant extends ClassicTransactionFlowIntake["_tag"]>(
    variant: Variant
  ) =>
    Atom.make(() =>
      getClassicTransactionFlowIntakeVariant(session.intake, variant)
    ).pipe(Atom.withLabel(`classicFlowSession${variant}Intake`));

  const reviewResources = makeClassicFlowSessionReviewResources({
    actionPreviewAtom,
    attachedActionAtom,
    intakeAtom,
    kycGateAtom,
  });

  return {
    ...reviewResources,
    actionPreviewAtom,
    attachedActionAtom,
    backAtom,
    confirmAtom,
    continueAtom,
    enterIntakeAtom: variantAtom("Enter"),
    exitIntakeAtom: variantAtom("Exit"),
    activityResumeIntakeAtom: variantAtom("ActivityResume"),
    intakeAtom,
    isCurrentSessionAtom,
    kycGateAtom,
    lifecycleAtom,
    navigationAtom,
    reviewRouteAtom,
    refreshKycAtom,
    retryAtom,
    manageIntakeAtom: variantAtom("Manage"),
    session,
    stepsRouteAtom,
    workflow,
    workflowKeyAtom,
  } as const;
};

export type ClassicFlowSessionFacade = ReturnType<
  typeof makeClassicFlowSessionFacade
>;

export const classicFlowSessionFacadeFamily = Atom.family(
  (session: ClassicFlowSession) =>
    makeClassicFlowSessionFacade({
      runtime: appRuntime,
      session,
      store: classicFlowSessionStore,
    })
);
