import type { TronResource } from "../../../../../domain/action/tron-resource";
import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../../../domain/earn/models";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import type { EarnEntryIntent, EarnTokenKey } from "../types";

const resetYieldIntent = (
  intent: EarnEntryIntent,
  selectedYieldId: YieldId | null
): EarnEntryIntent => ({
  ...intent,
  amountInput: "untouched",
  selectedProviderYieldId: null,
  selectedValidators: null,
  selectedYieldId,
  stakeAmount: "0",
  tronResource: null,
  useMaxAmount: false,
});

export const selectCategory = (
  intent: EarnEntryIntent,
  category: DashboardYieldCategory
): EarnEntryIntent =>
  intent.selectedCategory === category
    ? intent
    : resetYieldIntent(
        { ...intent, selectedCategory: category, selectedTokenKey: null },
        null
      );

export const selectToken = (
  intent: EarnEntryIntent,
  tokenKey: EarnTokenKey
): EarnEntryIntent =>
  intent.selectedTokenKey === tokenKey
    ? intent
    : resetYieldIntent({ ...intent, selectedTokenKey: tokenKey }, null);

export const selectYield = (
  intent: EarnEntryIntent,
  yieldId: YieldId
): EarnEntryIntent =>
  intent.selectedYieldId === yieldId
    ? intent
    : resetYieldIntent(intent, yieldId);

export const selectValidator = ({
  fallbackSelection,
  intent,
  multiselect,
  validator,
}: {
  readonly fallbackSelection: ReadonlyArray<EarnValidator>;
  readonly intent: EarnEntryIntent;
  readonly multiselect: boolean;
  readonly validator: EarnValidator;
}): EarnEntryIntent => {
  if (!multiselect) return { ...intent, selectedValidators: [validator] };

  const selected = intent.selectedValidators ?? fallbackSelection;
  const alreadySelected = selected.some(
    (candidate) => candidate.key === validator.key
  );
  const next = alreadySelected
    ? selected.filter((candidate) => candidate.key !== validator.key)
    : [...selected, validator];
  return next.length === 0 ? intent : { ...intent, selectedValidators: next };
};

export const removeValidator = ({
  fallbackSelection,
  intent,
  validatorKey,
}: {
  readonly fallbackSelection: ReadonlyArray<EarnValidator>;
  readonly intent: EarnEntryIntent;
  readonly validatorKey: EarnValidatorKey;
}): EarnEntryIntent => {
  const selected = intent.selectedValidators ?? fallbackSelection;
  if (selected.length === 1 && selected[0]?.key === validatorKey) return intent;
  return {
    ...intent,
    selectedValidators: selected.filter(
      (validator) => validator.key !== validatorKey
    ),
  };
};

export const selectProvider = (
  intent: EarnEntryIntent,
  selectedProviderYieldId: YieldId
): EarnEntryIntent => ({ ...intent, selectedProviderYieldId });

export const selectTronResource = (
  intent: EarnEntryIntent,
  tronResource: TronResource
): EarnEntryIntent => ({ ...intent, tronResource });

export const setAmount = (
  intent: EarnEntryIntent,
  stakeAmount: string
): EarnEntryIntent => ({
  ...intent,
  amountInput: "manual",
  stakeAmount,
  useMaxAmount: false,
});

export const setMaxAmount = (
  intent: EarnEntryIntent,
  stakeAmount: string
): EarnEntryIntent => ({
  ...intent,
  amountInput: "max",
  stakeAmount,
  useMaxAmount: true,
});
