import { tokenString } from "../../../../../domain/types/tokens";
import type { WalletScopeOwnerKey } from "../../../../../services/wallet/domain/scope";
import { sameWalletScopeOwner } from "../../../../../services/wallet/domain/scope";
import {
  type EarnEntry,
  type EarnMachineIntent,
  type EarnMachineView,
  makeDefaultEarnIntent,
} from "../types";

export type EarnMachineState = {
  readonly dashboardVariant: boolean;
  readonly initializationConsumed: boolean;
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
  dashboardVariant = false
): EarnMachineState =>
  previous &&
  sameOwner(previous.owner, owner) &&
  previous.dashboardVariant === dashboardVariant
    ? previous
    : {
        dashboardVariant,
        initializationConsumed: previous?.initializationConsumed ?? false,
        intent: makeDefaultEarnIntent(),
        owner,
      };

const sameKeys = <A>(first: ReadonlySet<A>, second: ReadonlySet<A>) =>
  first.size === second.size && [...first].every((key) => second.has(key));

export const reconcileEarnMachineView = (
  intent: EarnMachineIntent,
  view: EarnMachineView
): EarnMachineIntent => {
  if (view.status !== "ready" && view.status !== "no-validators") {
    return intent;
  }

  const validatorKeys = new Set(
    view.selection.validators.map((validator) => validator.key)
  );
  const next = {
    ...intent,
    selectedCategory: view.selection.category,
    selectedProviderYieldId: view.form.providerYieldId,
    selectedTokenKey: view.selection.token
      ? tokenString(view.selection.token.token)
      : null,
    selectedValidatorKeys: validatorKeys,
    selectedYieldId: view.selection.yield?.id ?? null,
    stakeAmount: view.form.stakeAmount,
    tronResource: view.form.tronResource,
    useMaxAmount: view.form.useMaxAmount,
  };

  return next.selectedCategory === intent.selectedCategory &&
    next.selectedProviderYieldId === intent.selectedProviderYieldId &&
    next.selectedTokenKey === intent.selectedTokenKey &&
    sameKeys(next.selectedValidatorKeys, intent.selectedValidatorKeys) &&
    next.selectedYieldId === intent.selectedYieldId &&
    next.stakeAmount === intent.stakeAmount &&
    next.tronResource === intent.tronResource &&
    next.useMaxAmount === intent.useMaxAmount
    ? intent
    : next;
};

const hasInitializationResolved = (view: EarnMachineView): boolean =>
  view.status === "ready" ||
  view.status === "no-categories" ||
  view.status === "no-tokens" ||
  view.status === "no-yields" ||
  view.status === "no-validators";

export const shouldConsumeEarnInitialization = ({
  entry,
  view,
}: {
  readonly entry: EarnEntry;
  readonly view: EarnMachineView;
}): boolean =>
  hasInitializationResolved(view) &&
  (!entry.initParams?.accountId || entry.walletScope !== null);
