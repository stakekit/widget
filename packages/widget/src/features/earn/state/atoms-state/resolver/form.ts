import type { EarnYield } from "../../../../../domain/schema/earn-models";
import type { PositionsData } from "../../../../../domain/types/positions";
import { getMinStakeAmount } from "../../../../../domain/types/stake";
import {
  getYieldActionArg,
  getYieldProviderYieldIds,
} from "../../../../../domain/types/yields";
import type { EarnMachineForm, EarnMachineIntent } from "../types";

export const resolveForm = ({
  intent,
  positionsData,
  selectedYield,
}: {
  intent: EarnMachineIntent;
  positionsData: PositionsData;
  selectedYield: EarnYield;
}): EarnMachineForm => ({
  providerYieldId:
    intent.selectedProviderYieldId ?? resolveProviderYieldId(selectedYield),
  stakeAmount: resolveStakeAmount({
    intent,
    positionsData,
    selectedYield,
  }),
  tronResource: intent.tronResource ?? resolveTronResource(selectedYield),
  useMaxAmount: intent.useMaxAmount,
});

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
  intent,
  positionsData,
  selectedYield,
}: {
  intent: EarnMachineIntent;
  positionsData: PositionsData;
  selectedYield: EarnYield;
}) => {
  if (intent.useMaxAmount || intent.stakeAmount !== "0") {
    return intent.stakeAmount;
  }

  return getMinStakeAmount(selectedYield, positionsData).toString(10);
};
