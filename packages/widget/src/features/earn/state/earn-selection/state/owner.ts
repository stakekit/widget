import { Equal } from "effect";
import type { InitParams } from "../../../../../services/wallet/init-params";
import type { WalletScopeOwnerKey } from "../../../../../services/wallet/wallet-scope";
import { sameWalletScopeOwner } from "../../../../../services/wallet/wallet-scope";
import { type EarnEntryIntent, makeDefaultEarnIntent } from "../types";

type EarnInitializationPhase =
  | "waiting-for-wallet"
  | "applying-init-params"
  | "complete";

export type EarnEntryState = {
  readonly dashboardVariant: boolean;
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

export const resetEarnEntryIntent = (
  previous: EarnEntryState
): EarnEntryState => {
  const next: EarnEntryState = {
    ...previous,
    initializationPhase: "complete",
    initParams: null,
    intent: makeDefaultEarnIntent(),
  };

  return Equal.equals(previous, next) ? previous : next;
};

export const reconcileEarnEntryOwner = (
  previous: EarnEntryState | null,
  owner: WalletScopeOwnerKey | null,
  dashboardVariant = false,
  walletResolution: "pending" | "settled" = "settled",
  initParams: InitParams | null = null
): EarnEntryState => {
  if (!previous) {
    const applying = walletResolution === "settled";
    return {
      dashboardVariant,
      initializationPhase: applying
        ? "applying-init-params"
        : "waiting-for-wallet",
      initParams: applying ? initParams : null,
      intent: makeDefaultEarnIntent(),
      owner,
    };
  }

  if (walletResolution === "pending") {
    return previous.initializationPhase === "applying-init-params"
      ? { ...previous, initializationPhase: "complete", initParams: null }
      : previous;
  }

  const ownerUnchanged = sameOwner(previous.owner, owner);
  const variantUnchanged = previous.dashboardVariant === dashboardVariant;

  if (
    previous.initializationPhase !== "waiting-for-wallet" &&
    ownerUnchanged &&
    variantUnchanged
  ) {
    return previous;
  }

  const applying = previous.initializationPhase === "waiting-for-wallet";
  return {
    dashboardVariant,
    initializationPhase: applying ? "applying-init-params" : "complete",
    initParams: applying ? initParams : null,
    intent: makeDefaultEarnIntent(),
    owner,
  };
};
