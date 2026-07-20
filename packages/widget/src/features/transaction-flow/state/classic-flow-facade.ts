import { Data, Duration, Effect, Result } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import { getValidStakeSessionTx } from "../../../domain";
import type { YieldAction } from "../../../domain/schema/action-models";
import {
  type ActionPreviewRequest,
  YieldApiService,
} from "../../../services/api/yield-api-service";
import { TrackingService } from "../../../services/tracking/tracking-service";
import { withApiResourcePolicy } from "../../../shared/effect/api-resource";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../../earn/resources/yield-insights";
import {
  abandonClassicTransactionFlow,
  attachClassicTransactionFlowAction,
  type ClassicTransactionFlow,
  type ClassicTransactionFlowIdentity,
  type ClassicTransactionFlowIntake,
  getClassicTransactionFlowActionPreviewInput,
  getClassicTransactionFlowKycYield,
  getClassicTransactionFlowVariant,
  getClassicTransactionFlowWorkflowHandoff,
  returnClassicTransactionFlowToReview,
  startClassicTransactionFlow,
} from "../model/classic-transaction-flow";
import { makeClassicFlowReviewResources } from "../resources/classic-flow-review-resources";
import { ClassicFlowIdentityService } from "../runtime/classic-flow-services";

type ClassicFlowRuntime = Atom.AtomRuntime<
  ClassicFlowIdentityService | TrackingService | YieldApiService
>;

type ClassicFlowNavigationOutcome =
  | {
      readonly _tag: "NavigateToSteps";
      readonly flowIdentity: ClassicTransactionFlowIdentity;
    }
  | {
      readonly _tag: "NavigateToReview";
      readonly flowIdentity: ClassicTransactionFlowIdentity;
    };

class ClassicFlowInvariantError extends Data.TaggedError(
  "ClassicFlowInvariantError"
)<{
  readonly flowIdentity: ClassicTransactionFlowIdentity;
  readonly message: string;
}> {}

export class ClassicFlowPreviewError extends Data.TaggedError(
  "ClassicFlowPreviewError"
)<{
  readonly cause: unknown;
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
  activeFlow: ClassicTransactionFlow | null,
  previewAllowed: boolean
): ClassicFlowPreviewKey | null => {
  if (!previewAllowed) return null;
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
          const api = yield* YieldApiService;
          return yield* api.previewAction(key.request).pipe(
            Effect.mapError(
              (cause) =>
                new ClassicFlowPreviewError({
                  cause,
                  message: "Classic Transaction Flow Action preview failed.",
                })
            )
          );
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
  const kycGateAtom = Atom.make((get) => {
    const yieldDto = getClassicTransactionFlowKycYield(
      get(stateAtom).activeFlow
    );
    return get(
      currentYieldKycGateAtom(
        new CurrentYieldKycGateKey({ enabled: true, yieldDto })
      )
    );
  }).pipe(Atom.withLabel("classicFlowKycGateAtom"));
  const refreshKycAtom = Atom.fnSync(
    (_input: undefined, get) => {
      const yieldDto = getClassicTransactionFlowKycYield(
        get(stateAtom).activeFlow
      );
      get.set(
        refreshCurrentYieldKycAtom(
          new CurrentYieldKycGateKey({ enabled: true, yieldDto })
        ),
        undefined
      );
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("refreshClassicFlowKycAtom"));
  const actionPreviewAtom = Atom.make((get) => {
    const key = getPreviewKey(
      get(stateAtom).activeFlow,
      !get(kycGateAtom).isGateBlocking
    );
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
      const key = getPreviewKey(
        before.activeFlow,
        !context.registry.get(kycGateAtom).isGateBlocking
      );
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
                const executableAction =
                  latest.activeFlow?._tag === "Exit"
                    ? getValidStakeSessionTx(action)
                    : Result.succeed(action);

                if (Result.isFailure(executableAction)) {
                  const error = new ClassicFlowInvariantError({
                    flowIdentity,
                    message:
                      "Classic Transaction Flow Exit preview contains an invalid transaction.",
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
                const attached = attachClassicTransactionFlowAction(
                  latest.activeFlow,
                  flowIdentity,
                  executableAction.success
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
      const key = getPreviewKey(
        state.activeFlow,
        !context.get(kycGateAtom).isGateBlocking
      );
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

  const trackConfirmationAtom = runtime.fn(
    Effect.fn("trackClassicFlowConfirmation")(function* (input: {
      readonly amount?: string;
      readonly yieldId: string;
    }) {
      const tracking = yield* TrackingService;
      yield* tracking.trackEvent("unstakeClicked", input);
    })
  );

  const confirmAtom = Atom.writable(
    (get) => get(runPreparationAtom),
    (context, flowIdentity: ClassicTransactionFlowIdentity) => {
      const state = context.get(stateAtom);
      if (
        state.activeFlow?.identity !== flowIdentity ||
        context.get(kycGateAtom).isGateBlocking
      ) {
        return;
      }

      if (
        state.preparation._tag === "Failure" &&
        state.preparation.flowIdentity === flowIdentity
      ) {
        context.set(retryAtom, flowIdentity);
        return;
      }

      if (state.activeFlow._tag === "Exit") {
        context.set(trackConfirmationAtom, {
          yieldId: state.activeFlow.integration.id,
          ...(state.activeFlow.request.arguments?.amount
            ? { amount: state.activeFlow.request.arguments.amount }
            : {}),
        });
      }

      context.set(continueAtom, flowIdentity);
    }
  ).pipe(Atom.withLabel("confirmClassicFlowAtom"));

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
          navigation: {
            _tag: "NavigateToReview",
            flowIdentity: result.activeFlow.identity,
          },
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
    confirmAtom,
    continueAtom,
    enterFlowAtom,
    exitFlowAtom,
    lifecycleAtom,
    kycGateAtom,
    manageFlowAtom,
    navigationAtom,
    preparationAtom,
    refreshKycAtom,
    retryAtom,
    returnToReviewAtom,
    startAtom,
    workflowHandoffAtom,
  } as const;
};

const coreClassicTransactionFlowFacade =
  makeClassicTransactionFlowFacade(appRuntime);

export const classicTransactionFlowFacade = {
  ...coreClassicTransactionFlowFacade,
  ...makeClassicFlowReviewResources(coreClassicTransactionFlowFacade),
} as const;
