import { useMemo } from "react";
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

  return useMemo(
    () =>
      providerDetails.map((val) => ({
        percentage: val.aprPercentage,
        yearly: stakeAmount.mapOrDefault(
          (am) => am.times(val.apr).decimalPlaces(5).toString(),
          ""
        ),
        monthly: stakeAmount.mapOrDefault(
          (am) => am.times(val.apr).dividedBy(12).decimalPlaces(5).toString(),
          ""
        ),
      })),
    [providerDetails, stakeAmount]
  );
};
