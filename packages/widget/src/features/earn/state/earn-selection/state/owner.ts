import { Equal } from "effect";
import type { WalletScopeOwnerKey } from "../../../../../domain/wallet/wallet-scope";
import { sameWalletScopeOwner } from "../../../../../domain/wallet/wallet-scope";
import type { InitParams } from "../../../../../services/wallet/init-params";
import { type EarnEntryIntent, makeDefaultEarnIntent } from "../types";

type EarnInitializationPhase =
  | "waiting-for-wallet"
  | "applying-init-params"
  | "complete";

export type EarnEntryState = {
  readonly categoryGrouping: boolean;
  readonly initializationPhase: EarnInitializationPhase;
  readonly initParams: InitParams | null;
  readonly intent: EarnEntryIntent;
  readonly owner: WalletScopeOwnerKey | null;
};

const sameOwner = (
  first: WalletScopeOwnerKey | null,
  second: WalletScopeOwnerKey | null
) =>
  first === null || second === null
    ? first === second
    : sameWalletScopeOwner(first, second);

/**
 * A started Transaction Workflow consumes the entered amount. Token, yield,
 * validators, provider and any initialization seed they came from stay, so the
 * details pane keeps describing what the workflow executes against.
 */
export const clearEarnEntryAmounts = (
  previous: EarnEntryState
): EarnEntryState => {
  const next: EarnEntryState = {
    ...previous,
    intent: {
      ...previous.intent,
      amountInput: "untouched",
      stakeAmount: "0",
      useMaxAmount: false,
    },
  };

  return Equal.equals(previous, next) ? previous : next;
};

export const reconcileEarnEntryOwner = (
  previous: EarnEntryState | null,
  owner: WalletScopeOwnerKey | null,
  categoryGrouping = false,
  walletResolution: "pending" | "settled" = "settled",
  initParams: InitParams | null = null
): EarnEntryState => {
  if (!previous) {
    const applying = walletResolution === "settled";
    return {
      categoryGrouping,
      initializationPhase: applying
        ? "applying-init-params"
        : "waiting-for-wallet",
      initParams: applying ? initParams : null,
      intent: makeDefaultEarnIntent(
        applying ? (initParams?.validator ?? null) : null
      ),
      owner,
    };
  }

  if (walletResolution === "pending") {
    return previous.initializationPhase === "applying-init-params"
      ? { ...previous, initializationPhase: "complete", initParams: null }
      : previous;
  }

  const ownerUnchanged = sameOwner(previous.owner, owner);
  const groupingUnchanged = previous.categoryGrouping === categoryGrouping;

  if (
    previous.initializationPhase !== "waiting-for-wallet" &&
    ownerUnchanged &&
    groupingUnchanged
  ) {
    return previous;
  }

  const applying = previous.initializationPhase === "waiting-for-wallet";
  return {
    categoryGrouping,
    initializationPhase: applying ? "applying-init-params" : "complete",
    initParams: applying ? initParams : null,
    intent: makeDefaultEarnIntent(
      applying ? (initParams?.validator ?? null) : null
    ),
    owner,
  };
};
