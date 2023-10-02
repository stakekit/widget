import { useMemo } from "react";
import { apyToPercentage } from "../utils";
import { State } from "../state/stake/types";
import { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";

export const useEstimatedRewards = ({
  selectedStake,
  stakeAmount,
  selectedValidator,
}: {
  selectedStake: Maybe<YieldDto>;
  stakeAmount: State["stakeAmount"];
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
