import { tokenString } from "../../../../../domain/types/tokens";
import type { EarnEntry, EarnMachineIntent, EarnMachineView } from "../types";

const sameValidators = (
  first: EarnMachineIntent["selectedValidators"],
  second: EarnMachineIntent["selectedValidators"]
) =>
  first === second ||
  (first !== null &&
    second !== null &&
    first.length === second.length &&
    first.every((validator, index) => validator.key === second[index]?.key));

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
  const selectedValidators = validatorTargeted
    ? view.selection.validators
    : intent.selectedValidators;
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
    sameValidators(intent.selectedValidators, selectedValidators);

  return selectionUnchanged
    ? intent
    : {
        ...intent,
        selectedCategory,
        selectedTokenKey,
        selectedValidators,
        selectedYieldId,
      };
};
