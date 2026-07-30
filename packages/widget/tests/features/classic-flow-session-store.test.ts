import { Effect, Layer, Schema, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { applicationRouterAtom } from "../../src/app/runtime/application-router-runtime";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  type ClassicTransactionFlowIntake,
  isClassicTransactionFlowWalletScopeValid,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { classicFlowSessionStore } from "../../src/features/classic-transaction-flow/state";
import { finishClassicTransactionFlowAtom } from "../../src/features/classic-transaction-flow/state/flow-session-store";
import { walletScopeAtom } from "../../src/features/wallet/state";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
  type WalletState,
} from "../../src/services/wallet/domain/state";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { yieldApiYieldFixture } from "../fixtures";
import { makeStartClassicFlowSession } from "../utils/classic-flow-session";

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x1234567890123456789012345678901234567890"
  ),
  network: "ethereum",
});
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x2234567890123456789012345678901234567890"
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
    },
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  };
};

const makeConnectedWalletState = (
  scope: WalletScopeKey
): NormalizedWalletState => ({
  additionalAddresses: scope.additionalAddresses,
  address: scope.address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: scope.network,
  status: "connected",
});

const makeMutableWalletRegistry = (initialScope: WalletScopeKey) => {
  const walletState = Effect.runSync(
    SubscriptionRef.make<WalletState>({
      connection: makeConnectedWalletState(initialScope),
      ledger: disconnectedLedgerConnectorState,
    })
  );
  const registry = AtomRegistry.make({
    initialValues: [
      [
        walletRuntime.layer,
        Layer.succeed(
          WalletService,
          WalletService.of({
            state: SubscriptionRef.get(walletState),
            states: SubscriptionRef.changes(walletState),
            wagmiConfig: {} as never,
          } as never)
        ) as never,
      ],
    ],
  });
  const unmount = registry.mount(classicFlowSessionStore.currentSessionAtom);

  return {
    registry,
    setWalletScope: (scope: WalletScopeKey) =>
      Effect.runSync(
        SubscriptionRef.set(walletState, {
          connection: makeConnectedWalletState(scope),
          ledger: disconnectedLedgerConnectorState,
        })
      ),
    unmount,
  } as const;
};

describe("Classic Flow Session intake store", () => {
  it("rejects a Start whose expected owner is no longer current", () => {
    const registry = AtomRegistry.make({
      initialValues: [[walletScopeAtom, otherWalletScope]],
    });

    registry.set(
      classicFlowSessionStore.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );

    expect(registry.get(classicFlowSessionStore.startAtom)).toBeNull();
    expect(registry.get(classicFlowSessionStore.currentSessionAtom)).toBeNull();
    registry.dispose();
  });

  it("abandons the stored Flow Session when its owner changes", async () => {
    const { registry, setWalletScope, unmount } =
      makeMutableWalletRegistry(walletScope);

    try {
      await vi.waitFor(() =>
        expect(registry.get(walletScopeAtom)).toEqual(walletScope)
      );
      registry.set(
        classicFlowSessionStore.startAtom,
        makeStartClassicFlowSession(makeEnterIntake())
      );
      expect(
        registry.get(classicFlowSessionStore.currentSessionAtom)
      ).not.toBeNull();

      setWalletScope(otherWalletScope);

      await vi.waitFor(() =>
        expect(
          registry.get(classicFlowSessionStore.currentSessionAtom)
        ).toBeNull()
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("captures the current full scope without abandoning the same owner", async () => {
    const scopeAtStart = new WalletScopeKey({
      additionalAddresses: {
        lidoStakeAccounts: ["lido-at-start"],
        stakeAccounts: ["stake-at-start"],
      },
      address: walletScope.address,
      network: walletScope.network,
    });
    const scopeAfterStart = new WalletScopeKey({
      additionalAddresses: {
        lidoStakeAccounts: ["lido-after-start"],
        stakeAccounts: ["stake-after-start"],
      },
      address: walletScope.address,
      network: walletScope.network,
    });
    const { registry, setWalletScope, unmount } =
      makeMutableWalletRegistry(scopeAtStart);

    try {
      await vi.waitFor(() =>
        expect(registry.get(walletScopeAtom)).toEqual(scopeAtStart)
      );
      registry.set(
        classicFlowSessionStore.startAtom,
        makeStartClassicFlowSession(makeEnterIntake())
      );
      const started = registry.get(classicFlowSessionStore.currentSessionAtom);

      expect(started?.intake.walletScope).toEqual(scopeAtStart);
      expect(started?.intake.walletScope).not.toBe(scopeAtStart);

      setWalletScope(scopeAfterStart);

      await vi.waitFor(() =>
        expect(registry.get(walletScopeAtom)).toEqual(scopeAfterStart)
      );
      expect(registry.get(classicFlowSessionStore.currentSessionAtom)).toBe(
        started
      );
      expect(started?.intake.walletScope).toEqual(scopeAtStart);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("finishes only the current Flow Session through runtime navigation", async () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [
          widgetConfigAtom,
          normalizeWidgetConfig({ apiKey: "test", variant: "default" }),
        ],
        [walletScopeAtom, walletScope],
      ],
    });

    try {
      const router = registry.get(applicationRouterAtom);
      await router.navigate("/review");
      registry.set(
        classicFlowSessionStore.startAtom,
        makeStartClassicFlowSession(makeEnterIntake())
      );
      const first = registry.get(classicFlowSessionStore.currentSessionAtom);
      registry.set(
        classicFlowSessionStore.startAtom,
        makeStartClassicFlowSession(makeEnterIntake())
      );
      const second = registry.get(classicFlowSessionStore.currentSessionAtom);
      if (!first || !second) throw new Error("Expected Flow Sessions");

      registry.set(finishClassicTransactionFlowAtom, first.epoch);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(router.state.location.pathname).toBe("/review");

      registry.set(finishClassicTransactionFlowAtom, second.epoch);
      await expect.poll(() => router.state.location.pathname).toBe("/");
    } finally {
      registry.dispose();
    }
  });

  it("isolates equal sessions and ignores cleanup from the replaced session", () => {
    const registry = AtomRegistry.make({
      initialValues: [[walletScopeAtom, walletScope]],
    });
    const intake = makeEnterIntake();
    if (intake._tag !== "Enter") throw new Error("Expected Enter intake");

    registry.set(
      classicFlowSessionStore.startAtom,
      makeStartClassicFlowSession(intake)
    );
    const first = registry.get(classicFlowSessionStore.currentSessionAtom);
    registry.set(
      classicFlowSessionStore.startAtom,
      makeStartClassicFlowSession(intake)
    );
    const second = registry.get(classicFlowSessionStore.currentSessionAtom);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.epoch).toBe(1);
    expect(second?.epoch).toBe(2);
    expect(second?.intake).not.toBe(intake);
    expect(second?.intake.walletScope).not.toBe(intake.walletScope);
    expect(
      second?.intake._tag === "Enter" ? second.intake.selectedValidators : null
    ).not.toBe(intake.selectedValidators);
    expect(
      second?.intake._tag === "Enter" ? second.intake.request : null
    ).not.toBe(intake.request);
    expect(
      second?.intake._tag === "Enter" ? second.intake.selectedStake : null
    ).not.toBe(intake.selectedStake);

    if (first) registry.set(classicFlowSessionStore.clearAtom, first.epoch);
    expect(registry.get(classicFlowSessionStore.currentSessionAtom)).toBe(
      second
    );

    if (second) registry.set(classicFlowSessionStore.clearAtom, second.epoch);
    expect(registry.get(classicFlowSessionStore.currentSessionAtom)).toBeNull();
  });

  it("validates wallet ownership without coupling to additional addresses", () => {
    const intake = makeEnterIntake();
    const sameEvmOwner = new WalletScopeKey({
      additionalAddresses: {
        lidoStakeAccounts: ["lido-account"],
        stakeAccounts: ["stake-account"],
      },
      address: Schema.decodeSync(WalletAddress)(
        walletScope.address.toUpperCase()
      ),
      network: walletScope.network,
    });
    const otherNetwork = new WalletScopeKey({
      address: walletScope.address,
      network: "base",
    });

    expect(isClassicTransactionFlowWalletScopeValid(intake, sameEvmOwner)).toBe(
      true
    );
    expect(isClassicTransactionFlowWalletScopeValid(intake, null)).toBe(false);
    expect(isClassicTransactionFlowWalletScopeValid(intake, otherNetwork)).toBe(
      false
    );
  });
});
