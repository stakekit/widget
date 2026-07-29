import type { WalletScopeOwnerKey } from "../../../../../services/wallet/domain/scope";
import { sameWalletScopeOwner } from "../../../../../services/wallet/domain/scope";
import { type EarnMachineIntent, makeDefaultEarnIntent } from "../types";

type EarnInitializationPhase =
  | "waiting-for-wallet"
  | "applying-init-params"
  | "complete";

export type EarnMachineState = {
  readonly dashboardVariant: boolean;
  readonly initializationPhase: EarnInitializationPhase;
  readonly intent: EarnMachineIntent;
  readonly owner: WalletScopeOwnerKey | null;
};

const sameOwner = (
  first: WalletScopeOwnerKey | null,
  second: WalletScopeOwnerKey | null
) =>
  first === null || second === null
    ? first === second
    : sameWalletScopeOwner(first, second);

export const reconcileEarnMachineOwner = (
  previous: EarnMachineState | null,
  owner: WalletScopeOwnerKey | null,
  dashboardVariant = false,
  walletResolution: "pending" | "settled" = "settled"
): EarnMachineState => {
  if (!previous) {
    return {
      dashboardVariant,
      initializationPhase:
        walletResolution === "pending"
          ? "waiting-for-wallet"
          : "applying-init-params",
      intent: makeDefaultEarnIntent(),
      owner,
    };
  }

  if (walletResolution === "pending") {
    return previous.initializationPhase === "applying-init-params"
      ? { ...previous, initializationPhase: "complete" }
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

  return {
    dashboardVariant,
    initializationPhase:
      previous.initializationPhase === "waiting-for-wallet"
        ? "applying-init-params"
        : "complete",
    intent: makeDefaultEarnIntent(),
    owner,
  };
};
