import { useMemo } from "react";
import type { State } from "../state/stake/types";
import type { YieldDto } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useProvidersDetails } from "./use-provider-details";
import { formatNumber } from "../utils";
import BigNumber from "bignumber.js";
import { getRewardRateFormatted } from "../utils/formatters";

export const useEstimatedRewards = ({
  selectedStake,
  stakeAmount,
  selectedValidators,
}: {
  selectedStake: Maybe<YieldDto>;
  stakeAmount: State["stakeAmount"];
  selectedValidators: State["selectedValidators"];
}) => {
  const providersDetails = useProvidersDetails({
    integrationData: selectedStake,
    validatorsAddresses: Maybe.of(selectedValidators),
  });

  return useMemo(
    () =>
      Maybe.fromRecord({ providersDetails, selectedStake })
        .map((val) => ({
          ...val,
          rewardRateAverage: val.providersDetails
            .reduce(
              (acc, val) => acc.plus(new BigNumber(val.rewardRate ?? 0)),
              new BigNumber(0)
            )
            .dividedBy(val.providersDetails.length),
        }))
        .map((val) => ({
          percentage: getRewardRateFormatted({
            rewardRate: val.rewardRateAverage.toNumber(),
            rewardType: val.selectedStake.rewardType,
          }),
          yearly: val.rewardRateAverage.isGreaterThan(0)
            ? formatNumber(
                stakeAmount.times(val.rewardRateAverage).decimalPlaces(5)
              )
            : "-",
          monthly: val.rewardRateAverage.isGreaterThan(0)
            ? formatNumber(
                stakeAmount
                  .times(val.rewardRateAverage)
                  .dividedBy(12)
                  .decimalPlaces(5)
              )
            : "-",
        })),
    [providersDetails, selectedStake, stakeAmount]
  );
};
