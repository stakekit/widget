import type { PositionsData } from "../../../../../../domain/types/positions";
import { getMinStakeAmount } from "../../../../../../domain/types/stake";
import { getYieldActionArg } from "../../../../../../domain/types/yields";
import type {
  EarnMachineForm,
  EarnMachineIntent,
  EarnYieldOption,
} from "../types";

export const resolveForm = ({
  intent,
  positionsData,
  selectedYield,
}: {
  intent: EarnMachineIntent;
  positionsData: PositionsData;
  selectedYield: EarnYieldOption;
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

const resolveProviderYieldId = (selectedYield: EarnYieldOption) => {
  const providerArg = getYieldActionArg(selectedYield, "enter", "providerId");

  if (!providerArg?.required || !providerArg.options?.length) {
    return null;
  }

  return providerArg.options[0] ?? null;
};

const resolveTronResource = (selectedYield: EarnYieldOption) =>
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
  selectedYield: EarnYieldOption;
}) => {
  if (intent.useMaxAmount || intent.stakeAmount !== "0") {
    return intent.stakeAmount;
  }

  return getMinStakeAmount(selectedYield, positionsData).toString(10);
};
