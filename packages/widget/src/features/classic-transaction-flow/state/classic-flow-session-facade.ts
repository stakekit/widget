import { Data, Duration, Effect, Option, Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { getValidStakeSessionTx } from "../../../domain";
import type { YieldAction } from "../../../domain/schema/action-models";
import {
  type ActionPreviewRequest,
  YieldOperations,
} from "../../../services/api/yield-operations";
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
  getClassicTransactionWorkflowInput,
} from "../model/classic-transaction-flow";
import { makeClassicFlowSessionReviewResources } from "../resources/classic-flow-review-resources";
import { type ClassicFlowSession, classicFlowSessionStore } from "../session";
import { makeClassicTransactionWorkflowModule } from "./classic-transaction-workflow";

class ClassicFlowPreviewError extends Data.TaggedError(
  "ClassicFlowPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: true;
}> {}

class ClassicFlowInvalidExitPreviewError extends Data.TaggedError(
  "ClassicFlowInvalidExitPreviewError"
)<{
  readonly cause: unknown;
  readonly message: string;
  readonly retryable: false;
}> {}

class ClassicFlowUnsupportedActivityPreviewError extends Data.TaggedError(
  "ClassicFlowUnsupportedActivityPreviewError"
)<{
  readonly message: string;
  readonly retryable: false;
}> {}

type ClassicFlowReviewError =
  | ClassicFlowInvalidExitPreviewError
  | ClassicFlowPreviewError
  | ClassicFlowUnsupportedActivityPreviewError;

type ClassicFlowSessionState = {
  readonly executionAction: YieldAction | null;
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
    case "ActivityResume": {
      if (intake.action.intent === "manage") return null;

      const command = {
        address: intake.action.address,
        ...(intake.action.rawArguments
          ? { arguments: intake.action.rawArguments }
          : {}),
        yieldId: intake.action.yieldId,
      };

      return { command, intent: intake.action.intent };
    }
  }
};

export const makeClassicFlowSessionModule = (session: ClassicFlowSession) => {
  const stateAtom = Atom.make<ClassicFlowSessionState>({
    executionAction: null,
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("classicFlowSessionState"));

  const isCurrentSessionAtom = Atom.make(
    (get) =>
      get(classicFlowSessionStore.currentSessionAtom)?.epoch === session.epoch
  ).pipe(Atom.withLabel("isCurrentClassicFlowSession"));

  const canPublishSharedOutputAtom = Atom.make((get) =>
    get(isCurrentSessionAtom)
  ).pipe(Atom.withLabel("canPublishClassicFlowSharedOutput"));

  const executionActionAtom = Atom.make(
    (get) => get(stateAtom).executionAction
  ).pipe(Atom.withLabel("classicFlowSessionExecutionAction"));

  const getIntake = <Variant extends ClassicTransactionFlowIntake["_tag"]>(
    variant: Variant
  ): Extract<ClassicTransactionFlowIntake, { readonly _tag: Variant }> => {
    const intake = getClassicTransactionFlowIntakeVariant(
      session.intake,
      variant
    );
    if (!intake) throw new Error(`Expected Classic Flow ${variant} intake.`);
    return intake;
  };

  const makeActivityCompleteView = (selectedAction: YieldAction) => {
    const activity = getIntake("ActivityResume");
    return {
      selectedAction,
      selectedValidators: activity.selectedValidators,
      selectedYield: activity.selectedYield,
    } as const;
  };

  const activityHistoryViewAtom = Atom.make(() => {
    const activity = getIntake("ActivityResume");
    return makeActivityCompleteView(activity.action);
  }).pipe(Atom.withLabel("classicFlowSessionActivityHistoryView"));

  const clearExecutionAtom = Atom.fnSync(
    (_input: undefined, context) => {
      if (context(stateAtom).executionAction === null) return;

      context.set(stateAtom, { executionAction: null });
    },
    { initialValue: undefined }
  ).pipe(Atom.setIdleTTL(0), Atom.withLabel("clearClassicFlowExecution"));

  const intakeAtom = Atom.make(session.intake).pipe(
    Atom.withLabel("classicFlowSessionIntake")
  );

  const kycGateAtom = Atom.make((get) =>
    get(
      currentYieldKycGateAtom(
        new CurrentYieldKycGateKey({
          enabled: true,
          yieldDto: getClassicTransactionFlowKycYield(get(intakeAtom)),
        })
      )
    )
  ).pipe(Atom.withLabel("classicFlowSessionKycGate"));

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

  const makeReviewFacade = () => {
    const previewRequest = getPreviewRequest(session.intake);
    const previewResourceAtom = previewRequest
      ? appRuntime
          .atom(
            YieldOperations.use((api) =>
              api.previewAction(previewRequest).pipe(
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
                    : Effect.succeed(validation.success);
                }),
                Effect.mapError((error) =>
                  error._tag === "ClassicFlowInvalidExitPreviewError"
                    ? error
                    : new ClassicFlowPreviewError({
                        cause: error,
                        message:
                          "Classic Transaction Flow Action preview failed.",
                        retryable: true,
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
            Atom.withLabel("classicFlowReviewPreview")
          )
      : Atom.make<
          AsyncResult.AsyncResult<YieldAction | null, ClassicFlowReviewError>
        >(
          AsyncResult.fail<
            ClassicFlowUnsupportedActivityPreviewError,
            YieldAction | null
          >(
            new ClassicFlowUnsupportedActivityPreviewError({
              message:
                "This Activity action cannot be recreated as a fresh Action preview.",
              retryable: false,
            })
          )
        ).pipe(Atom.setIdleTTL(0));

    const actionPreviewAtom = Atom.make((get) =>
      get(kycGateAtom).isGateBlocking
        ? AsyncResult.success(null)
        : get(previewResourceAtom)
    ).pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel("classicFlowReviewActionPreview")
    );

    const navigationStateAtom = Atom.make<"Steps" | null>(null).pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel("classicFlowReviewNavigationState")
    );

    const navigationAtom = Atom.make((get) =>
      get(canPublishSharedOutputAtom) ? get(navigationStateAtom) : null
    ).pipe(Atom.withLabel("classicFlowReviewNavigation"));

    const retryAtom = Atom.fnSync(
      (_input: undefined, context) => {
        const error = context(actionPreviewAtom).pipe(
          AsyncResult.error,
          Option.getOrNull
        );
        if (!error?.retryable) return;

        context.refresh(previewResourceAtom);
      },
      { initialValue: undefined }
    ).pipe(Atom.setIdleTTL(0), Atom.withLabel("retryClassicFlowReviewAtom"));

    const trackConfirmationAtom = appRuntime.fn(
      (
        input: {
          readonly amount?: string;
          readonly yieldId: string;
        },
        context
      ) => {
        if (!context(canPublishSharedOutputAtom)) return Effect.void;

        return Effect.gen(function* () {
          const tracking = yield* TrackingService;
          yield* tracking.trackEvent("unstakeClicked", input);
        }).pipe(Effect.withSpan("trackClassicFlowSessionConfirmation"));
      }
    );

    const reviewResources = makeClassicFlowSessionReviewResources({
      actionPreviewAtom,
      intakeAtom,
      kycGateAtom,
    });

    const confirmAtom = Atom.fnSync(
      (_input: undefined, context) => {
        if (context(kycGateAtom).isGateBlocking) return;
        if (
          session.intake._tag === "ActivityResume" &&
          context(reviewResources.activityActionExpiredAtom)
        ) {
          return;
        }

        if (AsyncResult.isFailure(context(actionPreviewAtom))) {
          context.set(retryAtom, undefined);
          return;
        }

        if (
          context(navigationStateAtom) === "Steps" ||
          context(executionActionAtom) !== null
        ) {
          return;
        }

        const action = context(actionPreviewAtom).pipe(
          AsyncResult.value,
          Option.getOrNull
        );
        if (!action) return;

        context.set(stateAtom, { executionAction: action });
        context.set(navigationStateAtom, "Steps");

        if (session.intake._tag === "Exit") {
          context.set(trackConfirmationAtom, {
            yieldId: session.intake.integration.id,
            ...(session.intake.request.arguments?.amount
              ? { amount: session.intake.request.arguments.amount }
              : {}),
          });
        }
      },
      { initialValue: undefined }
    ).pipe(Atom.setIdleTTL(0), Atom.withLabel("confirmClassicFlowReviewAtom"));

    return {
      activityReviewViewAtom: reviewResources.activityReviewViewAtom,
      confirmAtom,
      navigationAtom,
      refreshKycAtom,
      reviewViewAtom: reviewResources.reviewViewAtom,
    } as const;
  };

  const makeExecutionFacade = (action: YieldAction) => {
    const navigationStateAtom = Atom.make<"Review" | null>(null).pipe(
      Atom.setIdleTTL(0),
      Atom.withLabel("classicFlowExecutionNavigationState")
    );

    const actionAtom = Atom.make(action).pipe(
      Atom.withLabel("classicFlowExecutionAction")
    );

    const activityCompleteViewAtom = Atom.make(() =>
      makeActivityCompleteView(action)
    ).pipe(Atom.withLabel("classicFlowExecutionActivityCompleteView"));

    const workflowAtom = makeClassicTransactionWorkflowModule(
      getClassicTransactionWorkflowInput(session.intake, action)
    );

    const navigationAtom = Atom.make((get) =>
      get(canPublishSharedOutputAtom) && get(executionActionAtom) === action
        ? get(navigationStateAtom)
        : null
    ).pipe(Atom.withLabel("classicFlowExecutionNavigation"));

    const backAtom = Atom.fnSync(
      (_input: undefined, context) => {
        if (context(navigationStateAtom) === "Review") return;

        context.set(navigationStateAtom, "Review");
      },
      { initialValue: undefined }
    ).pipe(Atom.setIdleTTL(0), Atom.withLabel("backClassicFlowExecutionAtom"));

    return {
      activityCompleteViewAtom,
      actionAtom,
      backAtom,
      navigationAtom,
      workflowAtom,
    } as const;
  };

  const makeReviewScopeAtom = () =>
    Atom.make((context) => {
      context.set(clearExecutionAtom, undefined);

      return makeReviewFacade();
    }).pipe(Atom.setIdleTTL(0), Atom.withLabel("classicFlowReviewScope"));

  const makeExecutionScopeAtom = () =>
    Atom.make((context) => {
      const action = context.once(executionActionAtom);
      if (!action) return null;

      const { workflowAtom, ...execution } = makeExecutionFacade(action);
      const workflow = context(workflowAtom);
      return { ...execution, workflow } as const;
    }).pipe(Atom.setIdleTTL(0), Atom.withLabel("classicFlowExecutionScope"));

  const module = {
    facade: {
      activityHistoryViewAtom,
      getIntake,
      intake: session.intake,
    },
    ports: {
      makeExecutionScopeAtom,
      makeReviewScopeAtom,
    },
  } as const;

  const rootAtom = Atom.make((context) => {
    const registry = context.registry;
    context.mount(stateAtom);
    context.addFinalizer(() => {
      registry.set(classicFlowSessionStore.clearAtom, session.epoch);
    });

    return module;
  }).pipe(Atom.setIdleTTL(0), Atom.withLabel("classicFlowSessionRoot"));

  return rootAtom;
};

export type ClassicFlowSessionModule = Atom.Type<
  ReturnType<typeof makeClassicFlowSessionModule>
>;

export type ClassicFlowSessionFacade = ClassicFlowSessionModule["facade"];

export const makeClassicFlowReviewScope = (session: ClassicFlowSessionModule) =>
  session.ports.makeReviewScopeAtom();

export const makeClassicFlowExecutionScope = (
  session: ClassicFlowSessionModule
) => session.ports.makeExecutionScopeAtom();

export type ClassicFlowReviewFacade = Atom.Type<
  ReturnType<typeof makeClassicFlowReviewScope>
>;

export type ClassicFlowExecutionFacade = NonNullable<
  Atom.Type<ReturnType<typeof makeClassicFlowExecutionScope>>
>;
