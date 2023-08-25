import { useMemo } from "react";
import { apyToPercentage } from "../utils";
import { State } from "../state/stake/types";

export const useEstimatedRewards = ({
  stakeAmount,
  selectedStake,
  selectedValidator,
}: {
  stakeAmount: State["stakeAmount"];
  selectedStake: State["selectedStake"];
  selectedValidator: State["selectedValidator"];
}) => {
  return useMemo(() => {
    return selectedStake.map((y) => {
      const apy =
        selectedValidator.map((v) => v.apr).extractNullable() ?? y.apy;

      return {
        percentage: apyToPercentage(apy),
        yearly: stakeAmount.mapOrDefault(
          (am) => am.times(apy).decimalPlaces(5).toString(),
          ""
        ),
        monthly: stakeAmount.mapOrDefault(
          (am) => am.times(apy).dividedBy(12).decimalPlaces(5).toString(),
          ""
        ),
      };
    });
  }, [selectedStake, selectedValidator, stakeAmount]);
};
