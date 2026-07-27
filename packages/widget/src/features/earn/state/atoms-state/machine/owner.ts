import type { WalletScopeOwnerKey } from "../../../../../services/wallet/domain/scope";
import { sameWalletScopeOwner } from "../../../../../services/wallet/domain/scope";
import { type EarnMachineIntent, makeDefaultEarnIntent } from "../types";

export type EarnMachineState = {
  readonly dashboardVariant: boolean;
  readonly intent: EarnMachineIntent;
  readonly owner: WalletScopeOwnerKey | null;
  readonly userSelected: boolean;
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
  dashboardVariant = false
): EarnMachineState =>
  previous &&
  sameOwner(previous.owner, owner) &&
  previous.dashboardVariant === dashboardVariant
    ? previous
    : {
        dashboardVariant,
        intent: makeDefaultEarnIntent(),
        owner,
        userSelected: previous?.userSelected ?? false,
      };
