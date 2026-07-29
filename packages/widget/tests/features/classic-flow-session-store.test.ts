import { Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { applicationRouterAtom } from "../../src/app/runtime/application-router-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  type ClassicTransactionFlowIntake,
  isClassicTransactionFlowWalletScopeValid,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { classicFlowSessionStore } from "../../src/features/classic-transaction-flow/state";
import {
  finishClassicTransactionFlowAtom,
  makeClassicFlowSessionStore,
} from "../../src/features/classic-transaction-flow/state/flow-session-store";
import { walletScopeAtom } from "../../src/features/wallet/state";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
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

describe("Classic Flow Session intake store", () => {
  it("rejects a Start whose expected owner is no longer current", () => {
    const store = makeClassicFlowSessionStore(Atom.make(otherWalletScope));
    const registry = AtomRegistry.make();

    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );

    expect(registry.get(store.startAtom)).toBeNull();
    expect(registry.get(store.currentSessionAtom)).toBeNull();
    registry.dispose();
  });

  it("abandons the stored Flow Session when its owner changes", () => {
    const currentWalletScopeAtom = Atom.make<WalletScopeKey | null>(
      walletScope
    );
    const store = makeClassicFlowSessionStore(currentWalletScopeAtom);
    const registry = AtomRegistry.make();

    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    expect(registry.get(store.currentSessionAtom)).not.toBeNull();

    registry.set(currentWalletScopeAtom, otherWalletScope);

    expect(registry.get(store.currentSessionAtom)).toBeNull();
    registry.dispose();
  });

  it("captures the current full scope without abandoning the same owner", () => {
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
    const currentWalletScopeAtom = Atom.make<WalletScopeKey | null>(
      scopeAtStart
    );
    const store = makeClassicFlowSessionStore(currentWalletScopeAtom);
    const registry = AtomRegistry.make();

    registry.set(
      store.startAtom,
      makeStartClassicFlowSession(makeEnterIntake())
    );
    const started = registry.get(store.currentSessionAtom);

    expect(started?.intake.walletScope).toEqual(scopeAtStart);
    expect(started?.intake.walletScope).not.toBe(scopeAtStart);

    registry.set(currentWalletScopeAtom, scopeAfterStart);

    expect(registry.get(store.currentSessionAtom)).toBe(started);
    expect(started?.intake.walletScope).toEqual(scopeAtStart);
    registry.dispose();
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
    const store = makeClassicFlowSessionStore(Atom.make(walletScope));
    const registry = AtomRegistry.make();
    const intake = makeEnterIntake();
    if (intake._tag !== "Enter") throw new Error("Expected Enter intake");

    registry.set(store.startAtom, makeStartClassicFlowSession(intake));
    const first = registry.get(store.currentSessionAtom);
    registry.set(store.startAtom, makeStartClassicFlowSession(intake));
    const second = registry.get(store.currentSessionAtom);

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

    if (first) registry.set(store.clearAtom, first.epoch);
    expect(registry.get(store.currentSessionAtom)).toBe(second);

    if (second) registry.set(store.clearAtom, second.epoch);
    expect(registry.get(store.currentSessionAtom)).toBeNull();
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
