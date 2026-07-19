import BigNumber from "bignumber.js";
import { Effect, Latch, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import type {
  ActionCommand,
  ManageActionCommand,
} from "../../src/domain/schema/action-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type {
  ClassicTransactionFlowIdentity,
  ClassicTransactionFlowIntake,
} from "../../src/features/transaction-flow/model/classic-transaction-flow";
import { makeClassicTransactionFlowIdentity } from "../../src/features/transaction-flow/model/classic-transaction-flow";
import {
  ClassicFlowIdentityService,
  ClassicFlowPreviewError,
  ClassicFlowPreviewService,
} from "../../src/features/transaction-flow/runtime/classic-flow-services";
import { makeClassicTransactionFlowFacade } from "../../src/features/transaction-flow/state/classic-flow-facade";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
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
    providersDetails: [{ name: "StakeKit" }],
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

const makeActivityIntake = (): ClassicTransactionFlowIntake => {
  const selectedYield = yieldApiYieldFixture();
  return {
    _tag: "ActivityResume",
    action: yieldApiActionFixture(),
    providersDetails: [],
    selectedValidators: [],
    selectedYield,
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

const makeManageIntake = (): ClassicTransactionFlowIntake => {
  const integration = yieldApiYieldFixture();
  return {
    _tag: "Manage",
    gasFeeToken: integration.mechanics.gasFeeToken,
    integration,
    interactedToken: integration.token,
    pendingActionType: "CLAIM_REWARDS",
    providersDetails: [],
    request: {
      action: "CLAIM_REWARDS",
      address: walletScope.address,
      yieldId: integration.id,
    } as ManageActionCommand,
    walletScope,
  };
};

const makeTestFacade = ({
  preview,
}: {
  readonly preview: ClassicFlowPreviewService["Service"]["preview"];
}) => {
  let identityCounter = 0;
  const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() })(
    Layer.mergeAll(
      Layer.succeed(
        ClassicFlowIdentityService,
        ClassicFlowIdentityService.of({
          next: Effect.sync(() =>
            makeClassicTransactionFlowIdentity(`flow-${++identityCounter}`)
          ),
        })
      ),
      Layer.succeed(
        ClassicFlowPreviewService,
        ClassicFlowPreviewService.of({ preview })
      )
    )
  );
  return makeClassicTransactionFlowFacade(runtime);
};

const mountFacade = (
  registry: AtomRegistry.AtomRegistry,
  facade: ReturnType<typeof makeClassicTransactionFlowFacade>
) => [
  registry.mount(facade.abandonAtom),
  registry.mount(facade.actionPreviewAtom),
  registry.mount(facade.activeFlowAtom),
  registry.mount(facade.continueAtom),
  registry.mount(facade.navigationAtom),
  registry.mount(facade.preparationAtom),
  registry.mount(facade.retryAtom),
  registry.mount(facade.returnToReviewAtom),
  registry.mount(facade.startAtom),
];

const start = async (
  registry: AtomRegistry.AtomRegistry,
  facade: ReturnType<typeof makeClassicTransactionFlowFacade>,
  intake: ClassicTransactionFlowIntake
) => {
  registry.set(facade.startAtom, intake);
  await vi.waitFor(() =>
    expect(registry.get(facade.activeFlowAtom)).not.toBeNull()
  );
  return registry.get(facade.activeFlowAtom)!;
};

const expectIdentity = (value: string): ClassicTransactionFlowIdentity =>
  makeClassicTransactionFlowIdentity(value);

describe("Classic Transaction Flow facade", () => {
  it("starts and atomically replaces tagged flows through read-only views", async () => {
    const facade = makeTestFacade({
      preview: () => Effect.succeed(yieldApiActionFixture()),
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);

    const enter = await start(registry, facade, makeEnterIntake());
    expect(enter).toMatchObject({
      _tag: "Enter",
      identity: "flow-1",
      phase: "Reviewing",
    });
    expect(registry.get(facade.enterFlowAtom)).toBe(enter);
    expect(registry.get(facade.activityResumeFlowAtom)).toBeNull();

    const activity = await start(registry, facade, makeActivityIntake());
    expect(activity).toMatchObject({
      _tag: "ActivityResume",
      identity: "flow-2",
      phase: "Executable",
    });
    expect(registry.get(facade.activeFlowAtom)).toBe(activity);
    expect(registry.get(facade.enterFlowAtom)).toBeNull();
    expect(registry.get(facade.activityResumeFlowAtom)).toBe(activity);

    unmount.forEach((dispose) => dispose());
  });

  it("starts narrow Exit and Manage flows and normalizes Exit execution", async () => {
    const kept = yieldApiTransactionFixture({ id: "kept" });
    const skipped = yieldApiTransactionFixture({
      id: "skipped",
      status: "SKIPPED",
    });
    const facade = makeTestFacade({
      preview: () =>
        Effect.succeed(
          yieldApiActionFixture({
            intent: "exit",
            transactions: [kept, skipped],
            type: "UNSTAKE",
          })
        ),
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);

    const exit = await start(registry, facade, makeExitIntake());
    expect(registry.get(facade.exitFlowAtom)).toBe(exit);
    registry.set(facade.continueAtom, exit.identity);
    await vi.waitFor(() =>
      expect(registry.get(facade.exitFlowAtom)?.phase).toBe("Executable")
    );
    expect(registry.get(facade.exitFlowAtom)).toMatchObject({
      action: { transactions: [{ id: "kept" }] },
    });

    const manage = await start(registry, facade, makeManageIntake());
    expect(registry.get(facade.manageFlowAtom)).toBe(manage);
    expect(registry.get(facade.exitFlowAtom)).toBeNull();

    unmount.forEach((dispose) => dispose());
  });

  it("coalesces repeated Continue intent into one preview and publishes navigation", async () => {
    const previewLatch = Latch.makeUnsafe();
    let previewCalls = 0;
    const action = yieldApiActionFixture();
    const facade = makeTestFacade({
      preview: () => {
        previewCalls += 1;
        return previewLatch.await.pipe(Effect.as(action));
      },
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const flow = await start(registry, facade, makeEnterIntake());

    await vi.waitFor(() => expect(previewCalls).toBe(1));
    registry.set(facade.continueAtom, flow.identity);
    registry.set(facade.continueAtom, flow.identity);

    expect(registry.get(facade.preparationAtom)).toEqual({
      _tag: "Loading",
      flowIdentity: flow.identity,
    });
    expect(previewCalls).toBe(1);

    previewLatch.openUnsafe();
    await vi.waitFor(() =>
      expect(registry.get(facade.activeFlowAtom)).toMatchObject({
        action,
        identity: flow.identity,
        phase: "Executable",
      })
    );
    expect(registry.get(facade.navigationAtom)).toEqual({
      _tag: "NavigateToSteps",
      flowIdentity: flow.identity,
    });

    unmount.forEach((dispose) => dispose());
  });

  it("publishes typed preview failure and allows one explicit Retry", async () => {
    let previewCalls = 0;
    const action = yieldApiActionFixture();
    const facade = makeTestFacade({
      preview: () =>
        Effect.suspend(() => {
          previewCalls += 1;
          return previewCalls === 1
            ? Effect.fail(
                new ClassicFlowPreviewError({
                  cause: "offline",
                  message: "preview unavailable",
                })
              )
            : Effect.succeed(action);
        }),
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const flow = await start(registry, facade, makeEnterIntake());

    await vi.waitFor(() =>
      expect(
        AsyncResult.isFailure(registry.get(facade.actionPreviewAtom))
      ).toBe(true)
    );
    registry.set(facade.continueAtom, flow.identity);
    await vi.waitFor(() =>
      expect(registry.get(facade.preparationAtom)).toMatchObject({
        _tag: "Failure",
        flowIdentity: flow.identity,
        retryable: true,
      })
    );

    registry.set(facade.continueAtom, flow.identity);
    expect(previewCalls).toBe(1);
    registry.set(facade.retryAtom, flow.identity);

    await vi.waitFor(() =>
      expect(registry.get(facade.activeFlowAtom)?.phase).toBe("Executable")
    );
    expect(previewCalls).toBe(2);
    expect(registry.get(facade.navigationAtom)?.flowIdentity).toBe(
      flow.identity
    );

    unmount.forEach((dispose) => dispose());
  });

  it("interrupts preparation on replacement and suppresses stale completion", async () => {
    const previewLatch = Latch.makeUnsafe();
    let interrupted = 0;
    const staleAction = yieldApiActionFixture({ id: "stale-action" });
    const facade = makeTestFacade({
      preview: () =>
        previewLatch.await.pipe(
          Effect.as(staleAction),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted += 1;
            })
          )
        ),
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const first = await start(registry, facade, makeEnterIntake());

    registry.set(facade.continueAtom, first.identity);
    const replacement = await start(registry, facade, makeEnterIntake());

    expect(replacement.identity).toBe("flow-2");
    await vi.waitFor(() => expect(interrupted).toBeGreaterThan(0));
    previewLatch.openUnsafe();
    await Effect.runPromise(Effect.yieldNow);
    expect(registry.get(facade.activeFlowAtom)).toBe(replacement);
    expect(registry.get(facade.navigationAtom)).toBeNull();

    unmount.forEach((dispose) => dispose());
  });

  it("interrupts preparation when the targeted flow is abandoned", async () => {
    const previewLatch = Latch.makeUnsafe();
    let interrupted = 0;
    const facade = makeTestFacade({
      preview: () =>
        previewLatch.await.pipe(
          Effect.as(yieldApiActionFixture()),
          Effect.onInterrupt(() =>
            Effect.sync(() => {
              interrupted += 1;
            })
          )
        ),
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const flow = await start(registry, facade, makeEnterIntake());

    registry.set(facade.continueAtom, flow.identity);
    registry.set(facade.abandonAtom, flow.identity);

    expect(registry.get(facade.activeFlowAtom)).toBeNull();
    await vi.waitFor(() => expect(interrupted).toBeGreaterThan(0));
    expect(registry.get(facade.navigationAtom)).toBeNull();

    unmount.forEach((dispose) => dispose());
  });

  it("continues Activity Resume without previewing or changing its identity", async () => {
    let previewCalls = 0;
    const facade = makeTestFacade({
      preview: () => {
        previewCalls += 1;
        return Effect.succeed(yieldApiActionFixture());
      },
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const flow = await start(registry, facade, makeActivityIntake());

    registry.set(facade.continueAtom, flow.identity);

    expect(previewCalls).toBe(0);
    expect(registry.get(facade.activeFlowAtom)).toBe(flow);
    expect(registry.get(facade.navigationAtom)).toEqual({
      _tag: "NavigateToSteps",
      flowIdentity: flow.identity,
    });

    unmount.forEach((dispose) => dispose());
  });

  it("creates fresh review identity on Enter Back and reuses Activity identity", async () => {
    const action = yieldApiActionFixture();
    let previewCalls = 0;
    const facade = makeTestFacade({
      preview: () => {
        previewCalls += 1;
        return Effect.succeed(action);
      },
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const enter = await start(registry, facade, makeEnterIntake());

    registry.set(facade.continueAtom, enter.identity);
    await vi.waitFor(() =>
      expect(registry.get(facade.activeFlowAtom)?.phase).toBe("Executable")
    );
    registry.set(facade.returnToReviewAtom, enter.identity);
    await vi.waitFor(() =>
      expect(registry.get(facade.activeFlowAtom)).toMatchObject({
        identity: "flow-2",
        phase: "Reviewing",
      })
    );
    await vi.waitFor(() => expect(previewCalls).toBe(2));

    const activity = await start(registry, facade, makeActivityIntake());
    registry.set(facade.returnToReviewAtom, activity.identity);
    await vi.waitFor(() =>
      expect(registry.get(facade.activeFlowAtom)).toBe(activity)
    );

    unmount.forEach((dispose) => dispose());
  });

  it("targeted lifecycle cleanup cannot clear a newer flow", async () => {
    const facade = makeTestFacade({
      preview: () => Effect.succeed(yieldApiActionFixture()),
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const first = await start(registry, facade, makeEnterIntake());
    const disposeFirstLifecycle = registry.mount(
      facade.lifecycleAtom(first.identity)
    );
    const second = await start(registry, facade, makeEnterIntake());

    disposeFirstLifecycle();
    await Effect.runPromise(Effect.yieldNow);
    expect(registry.get(facade.activeFlowAtom)).toBe(second);

    const disposeSecondLifecycle = registry.mount(
      facade.lifecycleAtom(second.identity)
    );
    disposeSecondLifecycle();
    await vi.waitFor(() =>
      expect(registry.get(facade.activeFlowAtom)).toBeNull()
    );

    unmount.forEach((dispose) => dispose());
  });

  it("keeps mutable storage private across fresh registry generations", async () => {
    const facade = makeTestFacade({
      preview: () => Effect.succeed(yieldApiActionFixture()),
    });
    const firstRegistry = AtomRegistry.make();
    const secondRegistry = AtomRegistry.make();
    const firstUnmount = mountFacade(firstRegistry, facade);
    const secondUnmount = mountFacade(secondRegistry, facade);

    const first = await start(firstRegistry, facade, makeEnterIntake());
    expect(first.identity).toBe("flow-1");
    expect(secondRegistry.get(facade.activeFlowAtom)).toBeNull();

    firstRegistry.set(facade.abandonAtom, first.identity);
    expect(firstRegistry.get(facade.activeFlowAtom)).toBeNull();
    expect(secondRegistry.get(facade.activeFlowAtom)).toBeNull();

    firstUnmount.forEach((dispose) => dispose());
    secondUnmount.forEach((dispose) => dispose());
  });

  it("ignores stale command identities", async () => {
    const facade = makeTestFacade({
      preview: () => Effect.succeed(yieldApiActionFixture()),
    });
    const registry = AtomRegistry.make();
    const unmount = mountFacade(registry, facade);
    const active = await start(registry, facade, makeEnterIntake());

    registry.set(facade.continueAtom, expectIdentity("stale"));
    registry.set(facade.retryAtom, expectIdentity("stale"));
    registry.set(facade.abandonAtom, expectIdentity("stale"));

    expect(registry.get(facade.activeFlowAtom)).toBe(active);
    expect(registry.get(facade.preparationAtom)).toEqual({ _tag: "Idle" });
    expect(registry.get(facade.navigationAtom)).toBeNull();

    unmount.forEach((dispose) => dispose());
  });
});
