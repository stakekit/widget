import { useMemo } from "react";
import { State } from "../state/stake/types";
import { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useProviderDetails } from "./use-provider-details";
import { formatNumber } from "../utils";

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

  return useMemo(
    () =>
      providerDetails.map((val) => ({
        percentage: val.rewardRateFormatted,
        yearly: stakeAmount.mapOrDefault(
          (am) => formatNumber(am.times(val.rewardRate).decimalPlaces(5)),
          ""
        ),
        monthly: stakeAmount.mapOrDefault(
          (am) =>
            formatNumber(
              am.times(val.rewardRate).dividedBy(12).decimalPlaces(5)
            ),
          ""
        ),
      })),
    [providerDetails, stakeAmount]
  );
};
