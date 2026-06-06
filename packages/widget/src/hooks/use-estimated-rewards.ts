import BigNumber from "bignumber.js";
import { List, Maybe } from "purify-ts";
import { useMemo } from "react";
import type { ValidatorDto } from "../domain/types/validators";
import { isBittensorStaking, type Yield } from "../domain/types/yields";
import { formatNumber } from "../utils";
import { getRewardRateFormatted } from "../utils/formatters";
import { useProvidersDetails } from "./use-provider-details";

export const useEstimatedRewards = ({
  selectedStake,
  stakeAmount,
  selectedValidators,
  selectedProviderYieldId,
}: {
  selectedStake: Maybe<Yield>;
  stakeAmount: BigNumber;
  selectedValidators: Map<ValidatorDto["address"], ValidatorDto>;
  selectedProviderYieldId: Maybe<Yield["id"]>;
}) => {
  const providersDetails = useProvidersDetails({
    integrationData: selectedStake,
    validators: Maybe.of(selectedValidators),
    selectedProviderYieldId,
  });

  /**
   * If the selected stake is a bittensor staking, we need to divide the stake amount by the price per share
   * to convert to subnet token
   */
  const correctAmount = useMemo(() => {
    return selectedStake
      .filter((val) => isBittensorStaking(val.id))
      .chain(() => List.head([...selectedValidators.values()]))
      .chainNullable((validator) => validator.pricePerShare)
      .map((pps) => stakeAmount.dividedBy(pps))
      .orDefault(stakeAmount);
  }, [selectedStake, stakeAmount, selectedValidators]);

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
          rewardRateAverage: val.rewardRateAverage,
          rewardType: val.selectedStake.rewardRate?.rateType?.toLowerCase(),
          percentage: getRewardRateFormatted({
            rewardRate: val.rewardRateAverage.toNumber(),
          }),
          yearly: val.rewardRateAverage.isGreaterThan(0)
            ? formatNumber(
                correctAmount.times(val.rewardRateAverage).decimalPlaces(5)
              )
            : "-",
          monthly: val.rewardRateAverage.isGreaterThan(0)
            ? formatNumber(
                correctAmount
                  .times(val.rewardRateAverage)
                  .dividedBy(12)
                  .decimalPlaces(5)
              )
            : "-",
        })),
    [providersDetails, selectedStake, correctAmount]
  );
};
