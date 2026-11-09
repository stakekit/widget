import type BigNumber from "bignumber.js";
import { getEnterAmountConstraint } from "../../../../../domain/earn/stake";
import {
  getYieldActionArg,
  resolveYieldProviderOption,
} from "../../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { exactDecimal } from "../../../../../domain/finance/exact";
import {
  hasActivePositionForYield,
  type PositionsData,
} from "../../../../../domain/portfolio/positions";
import type { EarnEntryIntent, EarnSelectionForm } from "../types";

export const canSubmitEarnForm = ({
  availableAmount,
  form,
  positionsData,
  selectedYield,
}: {
  readonly availableAmount: BigNumber | null;
  readonly form: EarnSelectionForm;
  readonly positionsData: PositionsData;
  readonly selectedYield: EarnYieldWithProvider;
}): boolean => {
  if (form.stakeAmount === "") return false;
  const amount = exactDecimal(form.stakeAmount);
  if (!amount.isFinite() || !amount.isGreaterThan(0)) return false;

  const constraint = getEnterAmountConstraint(
    selectedYield,
    hasActivePositionForYield(positionsData, selectedYield.id)
  );
  if (constraint.type === "force-max") {
    return (
      availableAmount !== null &&
      amount.isEqualTo(availableAmount) &&
      amount.isGreaterThan(0)
    );
  }

  if (amount.isLessThan(constraint.minimum)) return false;
  if (constraint.maximum && amount.isGreaterThan(constraint.maximum)) {
    return false;
  }
  if (availableAmount !== null && amount.isGreaterThan(availableAmount)) {
    return false;
  }

  const providerArg = getYieldActionArg(selectedYield, "enter", "providerId");
  if (providerArg?.required && form.providerOption === null) return false;

  const tronArg = getYieldActionArg(selectedYield, "enter", "tronResource");
  if (tronArg?.required && form.tronResource === null) return false;

  return true;
};

export const resolveForm = ({
  availableAmount,
  intent,
  positionsData,
  selectedYield,
}: {
  availableAmount: BigNumber | null;
  intent: EarnEntryIntent;
  positionsData: PositionsData;
  selectedYield: EarnYieldWithProvider;
}): EarnSelectionForm => {
  const constraint = getEnterAmountConstraint(
    selectedYield,
    hasActivePositionForYield(positionsData, selectedYield.id)
  );

  return {
    // A force-max amount is the balance, never one the user has yet to enter.
    amountTouched: constraint.type === "force-max" || intent.amountTouched,
    providerOption: resolveYieldProviderOption(
      selectedYield,
      intent.selectedProviderOption
    ),
    // A force-max yield always takes the whole balance.
    stakeAmount:
      constraint.type === "force-max"
        ? (availableAmount?.toFixed() ?? "0")
        : intent.stakeAmount,
    tronResource: resolveTronResource(selectedYield, intent),
    useMaxAmount: constraint.type === "force-max" ? true : intent.useMaxAmount,
  };
};

const resolveTronResource = (
  selectedYield: EarnYieldWithProvider,
  intent: EarnEntryIntent
) => {
  const tronArg = getYieldActionArg(selectedYield, "enter", "tronResource");
  const options = tronArg?.options ?? [];

  if (intent.tronResource && options.includes(intent.tronResource)) {
    return intent.tronResource;
  }

  return tronArg?.required ? (options[0] ?? null) : null;
};
