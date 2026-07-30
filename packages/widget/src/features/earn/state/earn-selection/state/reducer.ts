import { Match } from "effect";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { EarnMachineIntent } from "../types";
import type { EarnAction } from "./actions";

const resetYieldScopedIntent = (
  intent: EarnMachineIntent,
  selectedYieldId: YieldId | null
): EarnMachineIntent => ({
  ...intent,
  amountInput: "untouched",
  selectedProviderYieldId: null,
  selectedValidatorKeys: new Set(),
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
      selectedValidatorKeys: new Set([action.validatorKey]),
    })),
    Match.when({ type: "validator/multiselect" }, (action) => {
      const next = new Set(intent.selectedValidatorKeys);
      if (next.has(action.validatorKey)) {
        next.delete(action.validatorKey);
      } else {
        next.add(action.validatorKey);
      }

      return next.size === 0
        ? intent
        : { ...intent, selectedValidatorKeys: next };
    }),
    Match.when({ type: "validator/remove" }, (action) => {
      if (
        intent.selectedValidatorKeys.size === 1 &&
        intent.selectedValidatorKeys.has(action.validatorKey)
      ) {
        return intent;
      }

      const next = new Set(intent.selectedValidatorKeys);
      next.delete(action.validatorKey);

      return { ...intent, selectedValidatorKeys: next };
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
