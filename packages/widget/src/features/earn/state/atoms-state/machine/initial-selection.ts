import { tokenString } from "../../../../../domain/types/tokens";
import type { EarnEntry, EarnMachineIntent, EarnMachineView } from "../types";

const sameValidatorKeys = (
  first: ReadonlySet<string>,
  second: ReadonlySet<string>
) =>
  first.size === second.size &&
  Array.from(first).every((key) => second.has(key));

export const commitEarnInitialSelection = (
  entry: EarnEntry,
  intent: EarnMachineIntent,
  view: EarnMachineView
): EarnMachineIntent => {
  const yieldTargeted = entry.initParams?.yieldId != null;
  const tokenTargeted = yieldTargeted || entry.initParams?.token != null;
  const validatorTargeted = entry.initParams?.validator != null;
  const selectedTokenKey = (() => {
    if (!tokenTargeted) return intent.selectedTokenKey;
    return view.selection.token
      ? tokenString(view.selection.token.token)
      : null;
  })();
  const selectedValidatorKeys = validatorTargeted
    ? new Set(view.selection.validators.map((validator) => validator.key))
    : intent.selectedValidatorKeys;
  const selectedYieldId = yieldTargeted
    ? (view.selection.yield?.id ?? null)
    : intent.selectedYieldId;
  const selectedCategory = yieldTargeted
    ? view.selection.category
    : intent.selectedCategory;
  const selectionUnchanged =
    intent.selectedCategory === selectedCategory &&
    intent.selectedTokenKey === selectedTokenKey &&
    intent.selectedYieldId === selectedYieldId &&
    sameValidatorKeys(intent.selectedValidatorKeys, selectedValidatorKeys);

  return selectionUnchanged
    ? intent
    : {
        ...intent,
        selectedCategory,
        selectedTokenKey,
        selectedValidatorKeys,
        selectedYieldId,
      };
};
