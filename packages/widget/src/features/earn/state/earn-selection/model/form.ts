import BigNumber from "bignumber.js";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import { getEnterAmountConstraint } from "../../../../../domain/earn/stake";
import { getYieldActionArg } from "../../../../../domain/earn/yield";
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
  readonly availableAmount: string | null;
  readonly form: EarnSelectionForm;
  readonly positionsData: PositionsData;
  readonly selectedYield: EarnYieldWithProvider;
}): boolean => {
  const amount = new BigNumber(form.stakeAmount);
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
  if (providerArg?.required && form.providerYieldId === null) return false;

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
  availableAmount: string | null;
  intent: EarnEntryIntent;
  positionsData: PositionsData;
  selectedYield: EarnYieldWithProvider;
}): EarnSelectionForm => {
  const constraint = getEnterAmountConstraint(
    selectedYield,
    hasActivePositionForYield(positionsData, selectedYield.id)
  );

  return {
    providerYieldId: resolveProviderYieldId(selectedYield, intent),
    stakeAmount: resolveStakeAmount({
      availableAmount,
      constraint,
      intent,
    }),
    tronResource: resolveTronResource(selectedYield, intent),
    useMaxAmount: constraint.type === "force-max" ? true : intent.useMaxAmount,
  };
};

const resolveProviderYieldId = (
  selectedYield: EarnYieldWithProvider,
  intent: EarnEntryIntent
) => {
  const providerArg = getYieldActionArg(selectedYield, "enter", "providerId");
  const providerYieldIds = providerArg?.options ?? [];

  if (
    intent.selectedProviderYieldId &&
    providerYieldIds.includes(intent.selectedProviderYieldId)
  ) {
    return intent.selectedProviderYieldId;
  }

  if (!providerArg?.required || providerYieldIds.length === 0) {
    return null;
  }

  return providerYieldIds[0] ?? null;
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

const resolveStakeAmount = ({
  availableAmount,
  constraint,
  intent,
}: {
  availableAmount: string | null;
  constraint: ReturnType<typeof getEnterAmountConstraint>;
  intent: EarnEntryIntent;
}) => {
  if (constraint.type === "force-max") {
    return availableAmount ?? "0";
  }

  if (intent.amountInput !== "untouched") {
    return intent.stakeAmount;
  }

  return constraint.minimum.toString(10);
};
