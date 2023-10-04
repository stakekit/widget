import { useMemo } from "react";
import { apyToPercentage } from "../utils";
import { State } from "../state/stake/types";
import { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useProviderDetails } from "./use-provider-details";

export const useEstimatedRewards = ({
  selectedStake,
  stakeAmount,
  selectedValidator,
}: {
  selectedStake: Maybe<YieldDto>;
  stakeAmount: State["stakeAmount"];
  selectedValidator: State["selectedValidator"];
}) => {
  const providerDetails = useProviderDetails({
    integrationData: selectedStake,
    validatorAddress: selectedValidator.map((v) => v.address),
  });

  return useMemo(() => {
    return selectedStake.map((y) => {
      const apy = providerDetails.map((v) => v.apr).extract()!;

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
  }, [providerDetails, selectedStake, stakeAmount]);
};
