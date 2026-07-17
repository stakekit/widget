import type { EarnYield } from "../../../../../domain/schema/earn-models";
import type { PositionsData } from "../../../../../domain/types/positions";
import { getEnterAmountConstraint } from "../../../../../domain/types/stake";
import {
  getYieldActionArg,
  getYieldProviderYieldIds,
} from "../../../../../domain/types/yields";
import type { EarnMachineForm, EarnMachineIntent } from "../types";

export const resolveForm = ({
  availableAmount,
  intent,
  positionsData,
  selectedYield,
}: {
  availableAmount: string | null;
  intent: EarnMachineIntent;
  positionsData: PositionsData;
  selectedYield: EarnYield;
}): EarnMachineForm => {
  const constraint = getEnterAmountConstraint(selectedYield, positionsData);

  return {
    providerYieldId:
      intent.selectedProviderYieldId ?? resolveProviderYieldId(selectedYield),
    stakeAmount: resolveStakeAmount({
      availableAmount,
      constraint,
      intent,
    }),
    tronResource: intent.tronResource ?? resolveTronResource(selectedYield),
    useMaxAmount: constraint.type === "force-max" ? true : intent.useMaxAmount,
  };
};

const resolveProviderYieldId = (selectedYield: EarnYield) => {
  const providerArg = getYieldActionArg(selectedYield, "enter", "providerId");
  const providerYieldIds = getYieldProviderYieldIds(selectedYield);

  if (!providerArg?.required || providerYieldIds.length === 0) {
    return null;
  }

  return providerYieldIds[0] ?? null;
};

const resolveTronResource = (selectedYield: EarnYield) =>
  getYieldActionArg(selectedYield, "enter", "tronResource")?.required
    ? "ENERGY"
    : null;

const resolveStakeAmount = ({
  availableAmount,
  constraint,
  intent,
}: {
  availableAmount: string | null;
  constraint: ReturnType<typeof getEnterAmountConstraint>;
  intent: EarnMachineIntent;
}) => {
  if (constraint.type === "force-max") {
    return availableAmount ?? "0";
  }

  if (intent.useMaxAmount || intent.stakeAmount !== "0") {
    return intent.stakeAmount;
  }

  return constraint.minimum.toString(10);
};
