import { Match } from "effect";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import type { EarnMachineIntent } from "../types";
import type { EarnAction } from "./actions";

const resetYieldScopedIntent = (
  intent: EarnMachineIntent,
  selectedYieldId: YieldId | null
): EarnMachineIntent => ({
  ...intent,
  amountInput: "untouched",
  selectedProviderYieldId: null,
  selectedValidators: null,
  selectedYieldId,
  stakeAmount: "0",
  tronResource: null,
  useMaxAmount: false,
});

export const applyEarnAction = ({
  action,
  intent,
}: {
  action: EarnAction;
  intent: EarnMachineIntent;
}): EarnMachineIntent =>
  Match.value(action).pipe(
    Match.when({ type: "token/select" }, (action) =>
      intent.selectedTokenKey === action.tokenKey
        ? intent
        : resetYieldScopedIntent(
            {
              ...intent,
              selectedTokenKey: action.tokenKey,
            },
            null
          )
    ),
    Match.when({ type: "yield/select" }, (action) =>
      intent.selectedYieldId === action.yieldId
        ? intent
        : resetYieldScopedIntent(intent, action.yieldId)
    ),
    Match.when({ type: "category/select" }, (action) =>
      intent.selectedCategory === action.category
        ? intent
        : resetYieldScopedIntent(
            {
              ...intent,
              selectedCategory: action.category,
              selectedTokenKey: null,
            },
            null
          )
    ),
    Match.when({ type: "validator/select" }, (action) => ({
      ...intent,
      selectedValidators: [action.validator],
    })),
    Match.when({ type: "validator/multiselect" }, (action) => {
      const selected = intent.selectedValidators ?? action.fallbackSelection;
      const alreadySelected = selected.some(
        (validator) => validator.key === action.validator.key
      );
      const next = alreadySelected
        ? selected.filter((validator) => validator.key !== action.validator.key)
        : [...selected, action.validator];

      return next.length === 0
        ? intent
        : { ...intent, selectedValidators: next };
    }),
    Match.when({ type: "validator/remove" }, (action) => {
      const selected = intent.selectedValidators ?? action.fallbackSelection;
      if (selected.length === 1 && selected[0]?.key === action.validatorKey) {
        return intent;
      }

      return {
        ...intent,
        selectedValidators: selected.filter(
          (validator) => validator.key !== action.validatorKey
        ),
      };
    }),
    Match.when({ type: "providerYieldId/select" }, (action) => ({
      ...intent,
      selectedProviderYieldId: action.providerYieldId,
    })),
    Match.when({ type: "stakeAmount/change" }, (action) => ({
      ...intent,
      amountInput: "manual" as const,
      stakeAmount: action.amount,
      useMaxAmount: false,
    })),
    Match.when({ type: "stakeAmount/max" }, (action) => ({
      ...intent,
      amountInput: "max" as const,
      stakeAmount: action.amount,
      useMaxAmount: true,
    })),
    Match.when({ type: "tronResource/select" }, (action) => ({
      ...intent,
      tronResource: action.tronResource,
    })),
    Match.exhaustive
  );
