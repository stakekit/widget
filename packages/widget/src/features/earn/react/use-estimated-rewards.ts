import BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/schema/earn-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import type { ValidatorKey } from "../../../domain/types/validators";
import { isBittensorStaking } from "../../../domain/types/yields";
import { formatNumber } from "../../../shared/lib";
import { getRewardRateFormatted } from "../../../shared/lib/formatters";
import { useProvidersDetails } from "./use-provider-details";

export const useEstimatedRewards = ({
  selectedStake,
  stakeAmount,
  selectedValidators,
  selectedProviderYieldId,
}: {
  readonly selectedProviderYieldId: YieldId | null;
  readonly selectedStake: EarnYieldWithProvider | null;
  readonly selectedValidators: Map<ValidatorKey, EarnValidator>;
  readonly stakeAmount: BigNumber;
}) => {
  const providersDetails = useProvidersDetails({
    integrationData: selectedStake,
    validators: selectedValidators,
    selectedProviderYieldId,
  });
  const firstValidator = EArray.head([...selectedValidators.values()]).pipe(
    Option.getOrNull
  );
  const pricePerShare = firstValidator?.subnet?.pricePerShare;
  const correctAmount =
    selectedStake && isBittensorStaking(selectedStake.id) && pricePerShare
      ? stakeAmount.dividedBy(pricePerShare)
      : stakeAmount;

  if (!providersDetails || !selectedStake) return null;

  const rewardRateAverage = providersDetails
    .reduce(
      (acc, provider) => acc.plus(new BigNumber(provider.rewardRate ?? 0)),
      new BigNumber(0)
    )
    .dividedBy(providersDetails.length);

  return {
    monthly: rewardRateAverage.isGreaterThan(0)
      ? formatNumber(
          correctAmount.times(rewardRateAverage).dividedBy(12).decimalPlaces(5)
        )
      : "-",
    percentage: getRewardRateFormatted({
      rewardRate: rewardRateAverage.toNumber(),
    }),
    rewardRateAverage,
    rewardType: selectedStake.rewardRate?.rateType?.toLowerCase(),
    yearly: rewardRateAverage.isGreaterThan(0)
      ? formatNumber(correctAmount.times(rewardRateAverage).decimalPlaces(5))
      : "-",
  };
};
