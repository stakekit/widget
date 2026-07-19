import { Data, Duration, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { classicFlowRuntime } from "../../../app/runtime/classic-flow-runtime";
import type { YieldAction } from "../../../domain/schema/action-models";
import type { ActionPreviewRequest } from "../../../services/api/yield-api-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import {
  abandonClassicTransactionFlow,
  attachClassicTransactionFlowAction,
  type ClassicTransactionFlow,
  type ClassicTransactionFlowIdentity,
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowActionPreviewInput,
  getClassicTransactionFlowVariant,
  getClassicTransactionFlowWorkflowHandoff,
  returnClassicTransactionFlowToReview,
  startClassicTransactionFlow,
} from "../model/classic-transaction-flow";
import { makeClassicFlowReviewResources } from "../resources/classic-flow-review-resources";
import {
  ClassicFlowIdentityService,
  type ClassicFlowPreviewError,
  ClassicFlowPreviewService,
} from "../runtime/classic-flow-services";

type ClassicFlowRuntime = Atom.AtomRuntime<
  ClassicFlowIdentityService | ClassicFlowPreviewService
>;

type ClassicFlowNavigationOutcome = {
  readonly _tag: "NavigateToSteps";
  readonly flowIdentity: ClassicTransactionFlowIdentity;
};

class ClassicFlowInvariantError extends Data.TaggedError(
  "ClassicFlowInvariantError"
)<{
  readonly flowIdentity: ClassicTransactionFlowIdentity;
  readonly message: string;
}> {}

type ClassicFlowPreparationState =
  | { readonly _tag: "Idle" }
  | {
      readonly _tag: "Loading";
      readonly flowIdentity: ClassicTransactionFlowIdentity;
    }
  | {
      readonly _tag: "Failure";
      readonly error: ClassicFlowPreviewError | ClassicFlowInvariantError;
      readonly flowIdentity: ClassicTransactionFlowIdentity;
      readonly retryable: boolean;
    };

type ClassicFlowFacadeState = {
  readonly activeFlow: ClassicTransactionFlow | null;
  readonly navigation: ClassicFlowNavigationOutcome | null;
  readonly preparation: ClassicFlowPreparationState;
};

const initialState: ClassicFlowFacadeState = {
  activeFlow: null,
  navigation: null,
  preparation: { _tag: "Idle" },
};

class ClassicFlowPreviewKey extends Data.Class<{
  readonly flowIdentity: ClassicTransactionFlowIdentity;
  readonly request: ActionPreviewRequest;
}> {}

const getPreviewKey = (
  activeFlow: ClassicTransactionFlow | null
): ClassicFlowPreviewKey | null => {
  const input = getClassicTransactionFlowActionPreviewInput(activeFlow);
  if (!input) return null;

  const request: ActionPreviewRequest =
    input.intent === "manage"
      ? { command: input.command, intent: input.intent }
      : { command: input.command, intent: input.intent };
  return new ClassicFlowPreviewKey({
    flowIdentity: input.flowIdentity,
    request,
  });
};

export const makeClassicTransactionFlowFacade = (
  runtime: ClassicFlowRuntime
) => {
  const stateAtom = Atom.make<ClassicFlowFacadeState>(initialState).pipe(
    Atom.keepAlive,
    Atom.withLabel("classicFlowStateAtom")
  );

  const previewResourceAtom = Atom.family((key: ClassicFlowPreviewKey) =>
    runtime
      .atom(
        Effect.gen(function* () {
          const preview = yield* ClassicFlowPreviewService;
          return yield* preview.preview(key.request);
        })
      )
      .pipe(
        withApiResourcePolicy({
          idleTTL: Duration.zero,
          revalidateOnMount: false,
          staleTime: Duration.infinity,
        }),
        Atom.withLabel(`classicFlowPreview(${key.flowIdentity})`)
      )
  );

  const refreshPreviewResourceAtom = Atom.family((key: ClassicFlowPreviewKey) =>
    Atom.fnSync(
      (_input: undefined, get) => get.refresh(previewResourceAtom(key)),
      { initialValue: undefined }
    )
  );

  const activeFlowAtom = Atom.make((get) => get(stateAtom).activeFlow).pipe(
    Atom.withLabel("activeClassicFlowAtom")
  );
  const preparationAtom = Atom.make((get) => get(stateAtom).preparation).pipe(
    Atom.withLabel("classicFlowPreparationAtom")
  );
  const navigationAtom = Atom.make((get) => get(stateAtom).navigation).pipe(
    Atom.withLabel("classicFlowNavigationAtom")
  );
  const actionPreviewAtom = Atom.make((get) => {
    const key = getPreviewKey(get(stateAtom).activeFlow);
    return key
      ? get(previewResourceAtom(key))
      : AsyncResult.success<YieldAction | null, ClassicFlowPreviewError>(null);
  }).pipe(Atom.withLabel("classicFlowActionPreviewAtom"));
  const workflowHandoffAtom = Atom.make((get) =>
    getClassicTransactionFlowWorkflowHandoff(get(stateAtom).activeFlow)
  ).pipe(Atom.withLabel("classicFlowWorkflowHandoffAtom"));

  const variantAtom = <Variant extends ClassicTransactionFlow["_tag"]>(
    variant: Variant
  ) =>
    Atom.make((get) =>
      getClassicTransactionFlowVariant(get(stateAtom).activeFlow, variant)
    ).pipe(Atom.withLabel(`classicFlow${variant}Atom`));

  const enterFlowAtom = variantAtom("Enter");
  const exitFlowAtom = variantAtom("Exit");
  const manageFlowAtom = variantAtom("Manage");
  const activityResumeFlowAtom = variantAtom("ActivityResume");

  const runPreparationAtom = runtime.fn(
    Effect.fn("prepareClassicTransactionFlow")(function* (
      flowIdentity: ClassicTransactionFlowIdentity,
      context: Atom.FnContext
    ) {
      const before = context.registry.get(stateAtom);
      const key = getPreviewKey(before.activeFlow);
      if (!key || key.flowIdentity !== flowIdentity) {
        return { _tag: "StaleFlow" as const, flowIdentity };
      }

      return yield* context
        .result(previewResourceAtom(key), { suspendOnWaiting: true })
        .pipe(
          Effect.matchEffect({
            onFailure: (error) =>
              Effect.sync(() => {
                const latest = context.registry.get(stateAtom);
                if (latest.activeFlow?.identity !== flowIdentity) {
                  return { _tag: "StaleFlow" as const, flowIdentity };
                }

                context.set(stateAtom, {
                  ...latest,
                  preparation: {
                    _tag: "Failure",
                    error,
                    flowIdentity,
                    retryable: true,
                  },
                });
                return { _tag: "Failed" as const, error, flowIdentity };
              }),
            onSuccess: (action) =>
              Effect.sync(() => {
                const latest = context.registry.get(stateAtom);
                const attached = attachClassicTransactionFlowAction(
                  latest.activeFlow,
                  flowIdentity,
                  action
                );

                if (attached._tag === "StaleFlow") {
                  return { _tag: "StaleFlow" as const, flowIdentity };
                }

                if (attached._tag === "NotReviewing") {
                  const error = new ClassicFlowInvariantError({
                    flowIdentity,
                    message:
                      "Classic Transaction Flow preparation completed outside Reviewing.",
                  });
                  context.set(stateAtom, {
                    ...latest,
                    preparation: {
                      _tag: "Failure",
                      error,
                      flowIdentity,
                      retryable: false,
                    },
                  });
                  return {
                    _tag: "InvariantFailure" as const,
                    error,
                    flowIdentity,
                  };
                }

                const navigation: ClassicFlowNavigationOutcome = {
                  _tag: "NavigateToSteps",
                  flowIdentity,
                };
                context.set(stateAtom, {
                  activeFlow: attached.activeFlow,
                  navigation,
                  preparation: { _tag: "Idle" },
                });
                return { _tag: "Prepared" as const, navigation };
              }),
          })
        );
    })
  );

  const startEffectAtom = runtime.fn(
    Effect.fn("startClassicTransactionFlow")(function* (
      intake: ClassicTransactionFlowIntake,
      context: Atom.FnContext
    ) {
      const identities = yield* ClassicFlowIdentityService;
      const identity = yield* identities.next;
      const latest = context.registry.get(stateAtom);
      const activeFlow = startClassicTransactionFlow(
        latest.activeFlow,
        identity,
        intake
      );

      context.set(stateAtom, {
        activeFlow,
        navigation: null,
        preparation: { _tag: "Idle" },
      });
      return activeFlow;
    })
  );

  const startAtom = Atom.writable(
    (get) => get(startEffectAtom),
    (context, intake: ClassicTransactionFlowIntake) => {
      context.set(runPreparationAtom, Atom.Interrupt);
      context.set(stateAtom, {
        ...context.get(stateAtom),
        navigation: null,
        preparation: { _tag: "Idle" },
      });
      context.set(startEffectAtom, intake);
    }
  ).pipe(Atom.withLabel("startClassicFlowAtom"));

  const continueAtom = Atom.writable(
    (get) => get(runPreparationAtom),
    (context, flowIdentity: ClassicTransactionFlowIdentity) => {
      const state = context.get(stateAtom);
      const activeFlow = state.activeFlow;
      if (activeFlow?.identity !== flowIdentity) return;

      if (activeFlow.phase === "Executable") {
        context.set(stateAtom, {
          ...state,
          navigation: { _tag: "NavigateToSteps", flowIdentity },
          preparation: { _tag: "Idle" },
        });
        return;
      }

      if (state.preparation._tag !== "Idle") return;

      context.set(stateAtom, {
        ...state,
        navigation: null,
        preparation: { _tag: "Loading", flowIdentity },
      });
      context.set(runPreparationAtom, flowIdentity);
    }
  ).pipe(Atom.withLabel("continueClassicFlowAtom"));

  const retryAtom = Atom.writable(
    (get) => get(runPreparationAtom),
    (context, flowIdentity: ClassicTransactionFlowIdentity) => {
      const state = context.get(stateAtom);
      const key = getPreviewKey(state.activeFlow);
      if (
        !key ||
        key.flowIdentity !== flowIdentity ||
        state.preparation._tag !== "Failure" ||
        state.preparation.flowIdentity !== flowIdentity ||
        !state.preparation.retryable
      ) {
        return;
      }

      context.set(refreshPreviewResourceAtom(key), undefined);
      context.set(stateAtom, {
        ...state,
        navigation: null,
        preparation: { _tag: "Loading", flowIdentity },
      });
      context.set(runPreparationAtom, flowIdentity);
    }
  ).pipe(Atom.withLabel("retryClassicFlowAtom"));

  const abandonAtom = Atom.fnSync(
    (flowIdentity: ClassicTransactionFlowIdentity, context) => {
      const state = context(stateAtom);
      const result = abandonClassicTransactionFlow(
        state.activeFlow,
        flowIdentity
      );
      if (result._tag === "Abandoned") {
        context.set(runPreparationAtom, Atom.Interrupt);
        context.set(stateAtom, initialState);
      }
      return result;
    }
  ).pipe(Atom.withLabel("abandonClassicFlowAtom"));

  const returnToReviewEffectAtom = runtime.fn(
    Effect.fn("returnClassicTransactionFlowToReview")(function* (
      flowIdentity: ClassicTransactionFlowIdentity,
      context: Atom.FnContext
    ) {
      const state = context.registry.get(stateAtom);
      const activeFlow = state.activeFlow;
      if (!activeFlow || activeFlow.identity !== flowIdentity) {
        return { _tag: "StaleFlow" as const, activeFlow };
      }

      const identities = yield* ClassicFlowIdentityService;
      const nextIdentity =
        activeFlow._tag === "ActivityResume"
          ? flowIdentity
          : yield* identities.next;
      const result = returnClassicTransactionFlowToReview(
        activeFlow,
        flowIdentity,
        nextIdentity
      );

      if (
        result._tag === "ReviewingStarted" ||
        result._tag === "ActivityResumeRetained"
      ) {
        context.set(runPreparationAtom, Atom.Interrupt);
        context.set(stateAtom, {
          activeFlow: result.activeFlow,
          navigation: null,
          preparation: { _tag: "Idle" },
        });
      }
      return result;
    })
  );

  const returnToReviewAtom = Atom.writable(
    (get) => get(returnToReviewEffectAtom),
    (context, flowIdentity: ClassicTransactionFlowIdentity) => {
      context.set(returnToReviewEffectAtom, flowIdentity);
    }
  ).pipe(Atom.withLabel("returnClassicFlowToReviewAtom"));

  const lifecycleAtom = Atom.family(
    (flowIdentity: ClassicTransactionFlowIdentity) =>
      Atom.make((context) => {
        const registry = context.registry;
        context.addFinalizer(() => {
          const state = registry.get(stateAtom);
          const result = abandonClassicTransactionFlow(
            state.activeFlow,
            flowIdentity
          );
          if (result._tag === "Abandoned") {
            registry.set(runPreparationAtom, Atom.Interrupt);
            registry.set(stateAtom, initialState);
          }
        });
      }).pipe(
        Atom.setIdleTTL(Duration.zero),
        Atom.withLabel(`classicFlowLifecycle(${flowIdentity})`)
      )
  );

  return {
    abandonAtom,
    actionPreviewAtom,
    activeFlowAtom,
    activityResumeFlowAtom,
    continueAtom,
    enterFlowAtom,
    exitFlowAtom,
    lifecycleAtom,
    manageFlowAtom,
    navigationAtom,
    preparationAtom,
    retryAtom,
    returnToReviewAtom,
    startAtom,
    workflowHandoffAtom,
  } as const;
};

const coreClassicTransactionFlowFacade =
  makeClassicTransactionFlowFacade(classicFlowRuntime);

export const classicTransactionFlowFacade = {
  ...coreClassicTransactionFlowFacade,
  ...makeClassicFlowReviewResources(coreClassicTransactionFlowFacade),
} as const;
