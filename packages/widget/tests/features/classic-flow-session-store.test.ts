import { Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  type ClassicTransactionFlowIntake,
  isClassicTransactionFlowWalletScopeValid,
} from "../../src/features/transaction-flow/model/classic-transaction-flow";
import { makeClassicFlowSessionStore } from "../../src/features/transaction-flow/state/classic-flow-session-store";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { yieldApiYieldFixture } from "../fixtures";

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
    },
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  };
};

describe("Classic Flow Session intake store", () => {
  it("isolates equal attempts and ignores cleanup from the replaced session", () => {
    const store = makeClassicFlowSessionStore();
    const registry = AtomRegistry.make();
    const intake = makeEnterIntake();
    if (intake._tag !== "Enter") throw new Error("Expected Enter intake");

    registry.set(store.startAtom, intake);
    const first = registry.get(store.currentSessionAtom);
    registry.set(store.startAtom, intake);
    const second = registry.get(store.currentSessionAtom);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second?.key).not.toBe(first?.key);
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

    if (first) registry.set(store.clearAtom, first.key);
    expect(registry.get(store.currentSessionAtom)).toBe(second);

    if (second) registry.set(store.clearAtom, second.key);
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
