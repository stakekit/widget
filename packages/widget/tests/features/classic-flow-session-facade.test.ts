import BigNumber from "bignumber.js";
import { DateTime, Duration, Effect, Layer, Schema, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import type {
  ActionCommand,
  YieldAction,
} from "../../src/domain/schema/action-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { ClassicTransactionFlowIntake } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  classicFlowSessionStore,
  makeStartClassicFlowSession,
} from "../../src/features/classic-transaction-flow/state";
import {
  makeClassicFlowExecutionScope,
  makeClassicFlowReviewScope,
  makeClassicFlowSessionModule,
} from "../../src/features/classic-transaction-flow/state/classic-flow-session-facade";
import {
  type ActionPreviewRequest,
  YieldOperations,
} from "../../src/services/api/yield-operations";
import { WidgetNavigation } from "../../src/services/navigation/widget-navigation";
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

const makeExitIntake = (): ClassicTransactionFlowIntake => {
  const integration = yieldApiYieldFixture();
  return {
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
  };
};

const makeAppLayer = (
  previewAction: (
    request: ActionPreviewRequest
  ) => Effect.Effect<YieldAction, unknown>,
  trackEvent: TrackingService["Service"]["trackEvent"] = () => Effect.void
) =>
  Layer.mergeAll(
    Layer.succeed(
      YieldOperations,
      YieldOperations.of({ previewAction } as never)
    ),
    Layer.succeed(
      TrackingService,
      TrackingService.of({
        trackEvent,
        trackPageView: () => Effect.void,
      })
    ),
    Layer.succeed(
      WidgetNavigation,
      WidgetNavigation.of({
        back: () => Effect.void,
        push: () => Effect.void,
        replace: () => Effect.void,
      })
    )
  );

const makeWorkflowLayer = (probe?: { disposed: number; started: number }) =>
  Layer.succeed(
    TransactionWorkflowService,
    TransactionWorkflowService.of({
      make: () =>
        Effect.acquireRelease(
          Effect.sync(() => {
            if (probe) probe.started += 1;
            return {
              dispatch: () => Effect.void,
              events: Stream.never,
              states: Stream.never,
            };
          }),
          () =>
            Effect.sync(() => {
              if (probe) probe.disposed += 1;
            })
        ),
    })
  );

const makeRegistry = (
  previewAction: (
    request: ActionPreviewRequest
  ) => Effect.Effect<YieldAction, unknown>,
  probe?: { disposed: number; started: number },
  trackEvent?: TrackingService["Service"]["trackEvent"]
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        makeAppLayer(previewAction, trackEvent) as never
      ),
      Atom.initialValue(walletRuntime.layer, makeWorkflowLayer(probe) as never),
    ],
  });

describe("Classic Flow Session module", () => {
  it("hands Review into Execution and creates a fresh attempt on Back", async () => {
    const actions = [
      yieldApiActionFixture({ id: "action-1" }),
      yieldApiActionFixture({ id: "action-2" }),
    ];
    let previewCalls = 0;
    const store = classicFlowSessionStore;
    const registry = makeRegistry(() =>
      Effect.succeed(actions[previewCalls++]!)
    );
    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected a Flow Session");

    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const flow = registry.get(rootAtom);

    const firstReviewAtom = makeClassicFlowReviewScope(flow);
    const firstReview = registry.get(firstReviewAtom);
    const disposeFirstReview = registry.mount(firstReview.reviewViewAtom);
    await vi.waitFor(() =>
      expect(registry.get(firstReview.reviewViewAtom).action?.id).toBe(
        "action-1"
      )
    );

    registry.set(firstReview.confirmAtom, undefined);

    const firstExecutionAtom = makeClassicFlowExecutionScope(flow);
    const firstExecution = registry.get(firstExecutionAtom);
    if (!firstExecution) throw new Error("Expected an Execution module");
    expect(registry.get(firstExecution.actionAtom).id).toBe("action-1");

    disposeFirstReview();
    registry.set(firstExecution.backAtom, undefined);
    registry.set(firstExecution.backAtom, undefined);

    const secondReviewAtom = makeClassicFlowReviewScope(flow);
    const secondReview = registry.get(secondReviewAtom);
    const disposeSecondReview = registry.mount(secondReview.reviewViewAtom);
    await vi.waitFor(() =>
      expect(registry.get(secondReview.reviewViewAtom).action?.id).toBe(
        "action-2"
      )
    );

    registry.set(secondReview.confirmAtom, undefined);
    const secondExecution = registry.get(makeClassicFlowExecutionScope(flow));
    if (!secondExecution) throw new Error("Expected a second Execution module");
    expect(registry.get(secondExecution.actionAtom).id).toBe("action-2");

    disposeSecondReview();
    disposeSession();
    await vi.waitFor(() =>
      expect(registry.get(store.currentSessionAtom)).toBeNull()
    );
  });

  it("does not let an exiting session clear or navigate a replacement", () => {
    const store = classicFlowSessionStore;
    const registry = makeRegistry(() =>
      Effect.succeed(yieldApiActionFixture())
    );
    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    const first = registry.get(store.currentSessionAtom);
    if (!first) throw new Error("Expected the first Flow Session");
    const firstRoot = makeClassicFlowSessionModule(first);
    const disposeFirst = registry.mount(firstRoot);
    const firstReview = registry.get(
      makeClassicFlowReviewScope(registry.get(firstRoot))
    );

    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    const second = registry.get(store.currentSessionAtom);
    if (!second) throw new Error("Expected the replacement Flow Session");
    const secondRoot = makeClassicFlowSessionModule(second);
    const disposeSecond = registry.mount(secondRoot);

    registry.set(firstReview.confirmAtom, undefined);
    expect(
      registry.get(makeClassicFlowExecutionScope(registry.get(firstRoot)))
    ).toBeNull();
    disposeFirst();
    expect(registry.get(store.currentSessionAtom)).toBe(second);

    disposeSecond();
  });

  it("previews a new Activity action and disposes each scoped workflow", async () => {
    const previews = [
      yieldApiActionFixture({ id: "fresh-action-1" }),
      yieldApiActionFixture({ id: "fresh-action-2" }),
    ];
    let previewCalls = 0;
    const previewAction = vi.fn(() =>
      Effect.succeed(previews[previewCalls++]!)
    );
    const probe = { disposed: 0, started: 0 };
    const store = classicFlowSessionStore;
    const registry = makeRegistry(previewAction, probe);
    const selectedYield = yieldApiYieldFixture();
    registry.set(
      store.startAtom,
      makeStartClassicFlowSession({
        _tag: "ActivityResume",
        action: yieldApiActionFixture({ id: "old-action" }),
        providersDetails: [],
        selectedValidators: [],
        selectedYield,
        walletScope,
      })
    );
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected an Activity Flow Session");
    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const flow = registry.get(rootAtom);
    expect(
      registry.get(flow.facade.activityHistoryViewAtom).selectedAction.id
    ).toBe("old-action");

    const firstReview = registry.get(makeClassicFlowReviewScope(flow));
    const disposeFirstReview = registry.mount(
      firstReview.activityReviewViewAtom
    );
    await vi.waitFor(() =>
      expect(registry.get(firstReview.activityReviewViewAtom).action?.id).toBe(
        "fresh-action-1"
      )
    );
    registry.set(firstReview.confirmAtom, undefined);
    const firstExecutionAtom = makeClassicFlowExecutionScope(flow);
    const disposeFirstExecution = registry.mount(firstExecutionAtom);
    const firstExecution = registry.get(firstExecutionAtom);
    if (!firstExecution) throw new Error("Expected the first Execution module");
    expect(registry.get(firstExecution.actionAtom).id).toBe("fresh-action-1");
    expect(
      registry.get(firstExecution.activityCompleteViewAtom).selectedAction.id
    ).toBe("fresh-action-1");
    await vi.waitFor(() => expect(probe.started).toBe(1));

    registry.set(firstExecution.backAtom, undefined);
    disposeFirstExecution();
    disposeFirstReview();
    await vi.waitFor(() => expect(probe.disposed).toBe(1));

    const secondReview = registry.get(makeClassicFlowReviewScope(flow));
    const disposeSecondReview = registry.mount(
      secondReview.activityReviewViewAtom
    );
    await vi.waitFor(() =>
      expect(registry.get(secondReview.activityReviewViewAtom).action?.id).toBe(
        "fresh-action-2"
      )
    );
    registry.set(secondReview.confirmAtom, undefined);
    const secondExecutionAtom = makeClassicFlowExecutionScope(flow);
    const disposeSecondExecution = registry.mount(secondExecutionAtom);
    const secondExecution = registry.get(secondExecutionAtom);
    if (!secondExecution) throw new Error("Expected a second Execution module");
    expect(registry.get(secondExecution.actionAtom).id).toBe("fresh-action-2");
    await vi.waitFor(() => expect(probe.started).toBe(2));
    expect(previewAction).toHaveBeenCalledTimes(2);

    disposeSecondExecution();
    disposeSecondReview();
    await vi.waitFor(() => expect(probe.disposed).toBe(2));
    disposeSession();
  });

  it("blocks confirmation when the resumed Activity action is seven days old", async () => {
    vi.useFakeTimers();
    try {
      const now = DateTime.makeUnsafe("2026-07-23T12:00:00.000Z");
      vi.setSystemTime(DateTime.toEpochMillis(now));
      const store = classicFlowSessionStore;
      const registry = makeRegistry(() =>
        Effect.succeed(yieldApiActionFixture({ id: "fresh-action" }))
      );
      registry.set(
        store.startAtom,
        makeStartClassicFlowSession({
          _tag: "ActivityResume",
          action: yieldApiActionFixture({
            id: "expired-action",
            createdAt: DateTime.subtractDuration(now, Duration.days(7)),
          }),
          providersDetails: [],
          selectedValidators: [],
          selectedYield: yieldApiYieldFixture(),
          walletScope,
        })
      );
      const session = registry.get(store.currentSessionAtom);
      if (!session) throw new Error("Expected an Activity Flow Session");
      const rootAtom = makeClassicFlowSessionModule(session);
      const disposeSession = registry.mount(rootAtom);
      const review = registry.get(
        makeClassicFlowReviewScope(registry.get(rootAtom))
      );
      const disposeReview = registry.mount(review.activityReviewViewAtom);

      await vi.advanceTimersByTimeAsync(0);
      expect(registry.get(review.activityReviewViewAtom).actionExpired).toBe(
        true
      );
      expect(registry.get(review.activityReviewViewAtom).confirmDisabled).toBe(
        true
      );

      registry.set(review.confirmAtom, undefined);
      expect(
        registry.get(makeClassicFlowExecutionScope(registry.get(rootAtom)))
      ).toBeNull();

      disposeReview();
      disposeSession();
    } finally {
      vi.useRealTimers();
    }
  });

  it("disposes the workflow when its Execution scope exits", async () => {
    const probe = { disposed: 0, started: 0 };
    const registry = makeRegistry(
      () => Effect.succeed(yieldApiActionFixture()),
      probe
    );
    registry.set(
      classicFlowSessionStore.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    const session = registry.get(classicFlowSessionStore.currentSessionAtom);
    if (!session) throw new Error("Expected a Flow Session");

    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const flow = registry.get(rootAtom);
    const review = registry.get(makeClassicFlowReviewScope(flow));
    const disposeReview = registry.mount(review.reviewViewAtom);
    await vi.waitFor(() =>
      expect(registry.get(review.reviewViewAtom).action).not.toBeNull()
    );
    registry.set(review.confirmAtom, undefined);

    const executionAtom = makeClassicFlowExecutionScope(flow);
    const disposeExecution = registry.mount(executionAtom);
    const execution = registry.get(executionAtom);
    if (!execution) throw new Error("Expected an Execution module");
    await vi.waitFor(() => expect(probe.started).toBe(1));

    const disposeStepsConsumer = registry.mount(execution.workflow.viewAtom);
    disposeExecution();
    await vi.waitFor(() => expect(probe.disposed).toBe(1));

    disposeStepsConsumer();
    expect(probe.disposed).toBe(1);
    disposeReview();
    disposeSession();
  });

  it("promotes and tracks Exit confirmation only once", async () => {
    const trackEvent = vi.fn(() => Effect.void);
    const registry = makeRegistry(
      () => Effect.succeed(yieldApiActionFixture()),
      undefined,
      trackEvent
    );
    registry.set(
      classicFlowSessionStore.startAtom,
      makeStartClassicFlowSession(makeExitIntake())
    );
    const session = registry.get(classicFlowSessionStore.currentSessionAtom);
    if (!session) throw new Error("Expected an Exit Flow Session");
    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const review = registry.get(
      makeClassicFlowReviewScope(registry.get(rootAtom))
    );
    const disposeReview = registry.mount(review.reviewViewAtom);
    await vi.waitFor(() =>
      expect(registry.get(review.reviewViewAtom).action).not.toBeNull()
    );

    registry.set(review.confirmAtom, undefined);
    registry.set(review.confirmAtom, undefined);

    await vi.waitFor(() => expect(trackEvent).toHaveBeenCalledOnce());
    disposeReview();
    disposeSession();
  });

  it("suppresses tracking from an exiting Review scope", async () => {
    const trackEvent = vi.fn(() => Effect.void);
    const registry = makeRegistry(
      () => Effect.succeed(yieldApiActionFixture()),
      undefined,
      trackEvent
    );
    registry.set(
      classicFlowSessionStore.startAtom,
      makeStartClassicFlowSession(makeExitIntake())
    );
    const session = registry.get(classicFlowSessionStore.currentSessionAtom);
    if (!session) throw new Error("Expected an Exit Flow Session");
    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const review = registry.get(
      makeClassicFlowReviewScope(registry.get(rootAtom))
    );
    const disposeReview = registry.mount(review.reviewViewAtom);
    await vi.waitFor(() =>
      expect(registry.get(review.reviewViewAtom).action).not.toBeNull()
    );

    registry.set(
      classicFlowSessionStore.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    registry.set(review.confirmAtom, undefined);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(trackEvent).not.toHaveBeenCalled();
    disposeReview();
    disposeSession();
  });

  it("does not promote an invalid Exit preview", async () => {
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
    const store = classicFlowSessionStore;
    const registry = makeRegistry(previewAction);
    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeExitIntake())
    );
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected an Exit Flow Session");
    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const review = registry.get(
      makeClassicFlowReviewScope(registry.get(rootAtom))
    );
    const disposeReview = registry.mount(review.reviewViewAtom);

    await vi.waitFor(() =>
      expect(registry.get(review.reviewViewAtom).actionPreviewLoading).toBe(
        false
      )
    );
    registry.set(review.confirmAtom, undefined);
    expect(previewAction).toHaveBeenCalledOnce();

    disposeReview();
    disposeSession();
  });

  it("continues into Execution after Confirm retries a preview failure", async () => {
    let previewCalls = 0;
    const previewAction = vi.fn(() => {
      previewCalls += 1;
      return previewCalls === 1
        ? Effect.fail(new Error("preview unavailable"))
        : Effect.succeed(yieldApiActionFixture({ id: "retried-action" }));
    });
    const store = classicFlowSessionStore;
    const registry = makeRegistry(previewAction);
    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected a Flow Session");
    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const review = registry.get(
      makeClassicFlowReviewScope(registry.get(rootAtom))
    );
    const disposeReview = registry.mount(review.reviewViewAtom);

    await vi.waitFor(() =>
      expect(registry.get(review.reviewViewAtom).actionPreviewLoading).toBe(
        false
      )
    );
    registry.set(review.confirmAtom, undefined);

    await vi.waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => {
      const execution = registry.get(
        makeClassicFlowExecutionScope(registry.get(rootAtom))
      );
      expect(execution).not.toBeNull();
      if (!execution) return;
      expect(registry.get(execution.actionAtom).id).toBe("retried-action");
    });
    expect(previewAction).toHaveBeenCalledTimes(2);

    disposeReview();
    disposeSession();
  });

  it("stays in Review when the Confirm retry also fails", async () => {
    const previewAction = vi.fn(() =>
      Effect.fail(new Error("preview unavailable"))
    );
    const store = classicFlowSessionStore;
    const registry = makeRegistry(previewAction);
    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    const session = registry.get(store.currentSessionAtom);
    if (!session) throw new Error("Expected a Flow Session");
    const rootAtom = makeClassicFlowSessionModule(session);
    const disposeSession = registry.mount(rootAtom);
    const review = registry.get(
      makeClassicFlowReviewScope(registry.get(rootAtom))
    );
    const disposeReview = registry.mount(review.reviewViewAtom);

    await vi.waitFor(() =>
      expect(registry.get(review.reviewViewAtom).actionPreviewLoading).toBe(
        false
      )
    );
    registry.set(review.confirmAtom, undefined);

    await vi.waitFor(() => expect(previewAction).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(registry.get(review.reviewViewAtom).actionPreviewLoading).toBe(
        false
      )
    );
    expect(
      registry.get(makeClassicFlowExecutionScope(registry.get(rootAtom)))
    ).toBeNull();
    expect(registry.get(review.reviewViewAtom).action).toBeNull();

    disposeReview();
    disposeSession();
  });
});
