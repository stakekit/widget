import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import type { ActionCommand } from "../../src/domain/schema/action-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { ClassicTransactionFlowIntake } from "../../src/features/transaction-flow/model/classic-transaction-flow";
import {
  ClassicFlowInvalidExitPreviewError,
  ClassicFlowPreviewError,
  makeClassicFlowSessionFacade,
} from "../../src/features/transaction-flow/state/classic-flow-session-facade";
import { makeClassicFlowSessionStore } from "../../src/features/transaction-flow/state/classic-flow-session-store";
import { YieldApiService } from "../../src/services/api/yield-api-service";
import { TrackingService } from "../../src/services/tracking/tracking-service";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { TransactionWorkflowService } from "../../src/services/workflow/transaction-workflow-service";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x1234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});

const makeEnterIntake = (): ClassicTransactionFlowIntake => {
  const selectedStake = yieldApiYieldFixture();
  return {
    _tag: "Enter",
    gasFeeToken: selectedStake.mechanics.gasFeeToken,
    providersDetails: [],
    request: {
      address: walletScope.address,
      arguments: { amount: "1" },
      yieldId: selectedStake.id,
    } as ActionCommand,
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  };
};

describe("Classic Flow Session facade", () => {
  it("attaches the reviewed candidate and prepares a fresh one after Back", async () => {
    const actions = [
      yieldApiActionFixture({ id: "action-1" }),
      yieldApiActionFixture({ id: "action-2" }),
    ];
    let previewCalls = 0;
    const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(
      Layer.mergeAll(
        Layer.succeed(
          YieldApiService,
          YieldApiService.of({
            previewAction: () => Effect.succeed(actions[previewCalls++]!),
          } as never)
        ),
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: () => Effect.void,
            trackPageView: () => Effect.void,
          })
        )
      )
    );
    const store = makeClassicFlowSessionStore();
    const registry = AtomRegistry.make();
    registry.set(store.startAtom, makeEnterIntake());
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected a Flow Session");

    const facade = makeClassicFlowSessionFacade({ runtime, session, store });
    const disposeLifecycle = registry.mount(facade.lifecycleAtom);
    const disposeFirstReviewRoute = registry.mount(
      facade.reviewRouteAtom("first-review")
    );
    registry.set(facade.backAtom, undefined);
    expect(registry.get(facade.navigationAtom)).toBeNull();
    const disposeFirstReview = registry.mount(facade.actionPreviewAtom);

    await vi.waitFor(() =>
      expect(
        registry
          .get(facade.actionPreviewAtom)
          .pipe(AsyncResult.value, Option.getOrNull)?.id
      ).toBe("action-1")
    );

    registry.set(facade.continueAtom, undefined);
    registry.set(facade.continueAtom, undefined);
    expect(registry.get(facade.attachedActionAtom)?.id).toBe("action-1");
    expect(registry.get(facade.navigationAtom)).toBe("Steps");

    disposeFirstReview();
    disposeFirstReviewRoute();
    const disposeStepsRoute = registry.mount(facade.stepsRouteAtom("steps"));
    registry.set(facade.backAtom, undefined);
    registry.set(facade.backAtom, undefined);
    expect(registry.get(facade.attachedActionAtom)).toBeNull();
    expect(registry.get(facade.navigationAtom)).toBe("Review");

    disposeStepsRoute();
    const disposeSecondReviewRoute = registry.mount(
      facade.reviewRouteAtom("second-review")
    );
    const disposeSecondReview = registry.mount(facade.actionPreviewAtom);
    await vi.waitFor(() =>
      expect(
        registry
          .get(facade.actionPreviewAtom)
          .pipe(AsyncResult.value, Option.getOrNull)?.id
      ).toBe("action-2")
    );

    disposeSecondReview();
    disposeSecondReviewRoute();
    disposeLifecycle();
  });

  it("normalizes regular actions when routing from Steps back into Review", async () => {
    const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(
      Layer.mergeAll(
        Layer.succeed(
          YieldApiService,
          YieldApiService.of({
            previewAction: () => Effect.succeed(yieldApiActionFixture()),
          } as never)
        ),
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: () => Effect.void,
            trackPageView: () => Effect.void,
          })
        )
      )
    );
    const store = makeClassicFlowSessionStore();
    const registry = AtomRegistry.make();
    registry.set(store.startAtom, makeEnterIntake());
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected a Flow Session");

    const facade = makeClassicFlowSessionFacade({ runtime, session, store });
    const disposeLifecycle = registry.mount(facade.lifecycleAtom);
    const disposeInitialReview = registry.mount(
      facade.reviewRouteAtom("initial-review")
    );
    const disposeReviewResource = registry.mount(facade.actionPreviewAtom);
    await vi.waitFor(() =>
      expect(
        registry.get(facade.actionPreviewAtom).pipe(AsyncResult.isSuccess)
      ).toBe(true)
    );

    registry.set(facade.continueAtom, undefined);
    disposeInitialReview();
    const disposeSteps = registry.mount(facade.stepsRouteAtom("steps"));
    expect(registry.get(facade.navigationAtom)).toBeNull();
    expect(registry.get(facade.attachedActionAtom)).not.toBeNull();

    disposeReviewResource();
    disposeSteps();
    const disposeReview = registry.mount(
      facade.reviewRouteAtom("returned-review")
    );
    expect(registry.get(facade.navigationAtom)).toBeNull();
    expect(registry.get(facade.attachedActionAtom)).toBeNull();

    disposeReview();
    disposeLifecycle();
  });

  it("keeps stale cleanup and navigation inside the exiting session", async () => {
    const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(
      Layer.mergeAll(
        Layer.succeed(
          YieldApiService,
          YieldApiService.of({
            previewAction: () => Effect.succeed(yieldApiActionFixture()),
          } as never)
        ),
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: () => Effect.void,
            trackPageView: () => Effect.void,
          })
        )
      )
    );
    const store = makeClassicFlowSessionStore();
    const registry = AtomRegistry.make();
    registry.set(store.startAtom, makeEnterIntake());
    const first = registry.get(store.currentSessionAtom);
    if (!first) throw new Error("Expected the first Flow Session");
    const firstFacade = makeClassicFlowSessionFacade({
      runtime,
      session: first,
      store,
    });
    const disposeFirst = registry.mount(firstFacade.lifecycleAtom);

    registry.set(store.startAtom, makeEnterIntake());
    const second = registry.get(store.currentSessionAtom);
    if (!second) throw new Error("Expected the replacement Flow Session");
    const secondFacade = makeClassicFlowSessionFacade({
      runtime,
      session: second,
      store,
    });
    const disposeSecond = registry.mount(secondFacade.lifecycleAtom);

    expect(firstFacade.workflow).not.toBe(secondFacade.workflow);

    registry.set(firstFacade.backAtom, undefined);
    expect(registry.get(firstFacade.navigationAtom)).toBeNull();
    disposeFirst();
    expect(registry.get(store.currentSessionAtom)).toBe(second);

    disposeSecond();
    await vi.waitFor(() =>
      expect(registry.get(store.currentSessionAtom)).toBeNull()
    );
  });

  it("retains the Activity Resume action and machine across Back", async () => {
    const previewAction = vi.fn(() => Effect.succeed(yieldApiActionFixture()));
    const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(
      Layer.mergeAll(
        Layer.succeed(
          YieldApiService,
          YieldApiService.of({ previewAction } as never)
        ),
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: () => Effect.void,
            trackPageView: () => Effect.void,
          })
        )
      )
    );
    const workflowProbe = { disposed: 0, started: 0 };
    const workflowLayer = Layer.succeed(
      TransactionWorkflowService,
      TransactionWorkflowService.of({
        make: () =>
          Effect.acquireRelease(
            Effect.sync(() => {
              workflowProbe.started += 1;
              return {
                dispatch: () => Effect.void,
                events: Stream.never,
                states: Stream.never,
              };
            }),
            () =>
              Effect.sync(() => {
                workflowProbe.disposed += 1;
              })
          ),
      })
    );
    const store = makeClassicFlowSessionStore();
    const registry = AtomRegistry.make({
      initialValues: [[walletRuntime.layer, workflowLayer]],
    });
    const selectedYield = yieldApiYieldFixture();
    const action = yieldApiActionFixture({ id: "activity-action" });
    registry.set(store.startAtom, {
      _tag: "ActivityResume",
      action,
      providersDetails: [],
      selectedValidators: [],
      selectedYield,
      walletScope,
    });
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected an Activity Resume Flow Session");
    const facade = makeClassicFlowSessionFacade({ runtime, session, store });
    const workflowKey = registry.get(facade.workflowKeyAtom);
    const disposeWorkflow = registry.mount(facade.workflow.lifecycleAtom);
    const disposeSteps = registry.mount(
      facade.stepsRouteAtom("activity-steps")
    );

    await vi.waitFor(() => expect(workflowProbe.started).toBe(1));

    expect(registry.get(facade.attachedActionAtom)).toEqual(action);
    expect(
      registry
        .get(facade.actionPreviewAtom)
        .pipe(AsyncResult.value, Option.getOrUndefined)
    ).toBeNull();
    registry.set(facade.backAtom, undefined);
    expect(registry.get(facade.attachedActionAtom)).toEqual(action);
    expect(registry.get(facade.workflowKeyAtom)).toEqual(workflowKey);
    expect(registry.get(facade.navigationAtom)).toBe("Review");
    expect(previewAction).not.toHaveBeenCalled();
    expect(workflowProbe.started).toBe(1);
    expect(workflowProbe.disposed).toBe(0);

    disposeWorkflow();
    disposeSteps();
    await vi.waitFor(() => expect(workflowProbe.disposed).toBe(1));
  });

  it("publishes invalid Exit content as a non-retryable typed failure", async () => {
    const previewAction = vi.fn(() =>
      Effect.succeed(
        yieldApiActionFixture({
          transactions: [
            yieldApiTransactionFixture({
              id: "failed-transaction",
              status: "FAILED",
            }),
          ],
        })
      )
    );
    const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(
      Layer.mergeAll(
        Layer.succeed(
          YieldApiService,
          YieldApiService.of({ previewAction } as never)
        ),
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: () => Effect.void,
            trackPageView: () => Effect.void,
          })
        )
      )
    );
    const store = makeClassicFlowSessionStore();
    const registry = AtomRegistry.make();
    const integration = yieldApiYieldFixture();
    registry.set(store.startAtom, {
      _tag: "Exit",
      gasFeeToken: integration.mechanics.gasFeeToken,
      integration,
      providersDetails: [],
      request: {
        address: walletScope.address,
        arguments: { amount: "1" },
        yieldId: integration.id,
      } as ActionCommand,
      unstakeAmount: new BigNumber(1),
      unstakeToken: integration.token,
      walletScope,
    });
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected an Exit Flow Session");
    const facade = makeClassicFlowSessionFacade({ runtime, session, store });
    const disposeReview = registry.mount(facade.reviewRouteAtom("exit-review"));
    const disposePreview = registry.mount(facade.actionPreviewAtom);

    await vi.waitFor(() =>
      expect(
        registry
          .get(facade.actionPreviewAtom)
          .pipe(AsyncResult.error, Option.getOrNull)
      ).toBeInstanceOf(ClassicFlowInvalidExitPreviewError)
    );

    registry.set(facade.retryAtom, undefined);
    registry.set(facade.continueAtom, undefined);
    expect(previewAction).toHaveBeenCalledOnce();
    expect(registry.get(facade.attachedActionAtom)).toBeNull();
    expect(registry.get(facade.navigationAtom)).toBeNull();
    disposePreview();
    disposeReview();
  });

  it("retries an ordinary preview failure without attaching partial state", async () => {
    let previewCalls = 0;
    const previewAction = vi.fn(() => {
      previewCalls += 1;
      return previewCalls === 1
        ? Effect.fail(new Error("preview unavailable"))
        : Effect.succeed(yieldApiActionFixture({ id: "retried-action" }));
    });
    const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(
      Layer.mergeAll(
        Layer.succeed(
          YieldApiService,
          YieldApiService.of({ previewAction } as never)
        ),
        Layer.succeed(
          TrackingService,
          TrackingService.of({
            trackEvent: () => Effect.void,
            trackPageView: () => Effect.void,
          })
        )
      )
    );
    const store = makeClassicFlowSessionStore();
    const registry = AtomRegistry.make();
    registry.set(store.startAtom, makeEnterIntake());
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected a Flow Session");
    const facade = makeClassicFlowSessionFacade({ runtime, session, store });
    const disposeReview = registry.mount(
      facade.reviewRouteAtom("retry-review")
    );
    const disposePreview = registry.mount(facade.actionPreviewAtom);

    await vi.waitFor(() =>
      expect(
        registry
          .get(facade.actionPreviewAtom)
          .pipe(AsyncResult.error, Option.getOrNull)
      ).toBeInstanceOf(ClassicFlowPreviewError)
    );
    expect(registry.get(facade.attachedActionAtom)).toBeNull();

    registry.set(facade.retryAtom, undefined);
    await vi.waitFor(() =>
      expect(
        registry
          .get(facade.actionPreviewAtom)
          .pipe(AsyncResult.value, Option.getOrNull)?.id
      ).toBe("retried-action")
    );
    registry.set(facade.retryAtom, undefined);
    expect(previewAction).toHaveBeenCalledTimes(2);
    disposePreview();
    disposeReview();
  });
});
