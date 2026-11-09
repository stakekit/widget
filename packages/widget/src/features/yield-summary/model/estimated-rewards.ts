import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import type {
  EarnValidator,
  EarnValidatorKey,
} from "../../../domain/earn/validator";
import { isBittensorStaking } from "../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { exactDecimal, exactZero } from "../../../domain/finance/exact";

type YieldRewardProvider = Readonly<{
  readonly rewardRate?: BigNumber | number | null | undefined;
}>;

export const getYieldEstimatedRewards = ({
  amount,
  providers,
  validators,
  yield: selectedYield,
}: {
  readonly amount: BigNumber;
  readonly providers: ReadonlyArray<YieldRewardProvider> | null;
  readonly validators: ReadonlyMap<EarnValidatorKey, EarnValidator>;
  readonly yield: EarnYieldWithProvider | null;
}) => {
  const firstValidator = EArray.head([...validators.values()]).pipe(
    Option.getOrNull
  );
  const pricePerShare = firstValidator?.subnet?.pricePerShare;
  const rewardAmount =
    selectedYield && isBittensorStaking(selectedYield.id) && pricePerShare
      ? amount.dividedBy(pricePerShare)
      : amount;
  if (!providers || !selectedYield) return null;

  const rewardRateAverage = providers
    .reduce(
      (total, provider) => total.plus(exactDecimal(provider.rewardRate ?? 0)),
      exactZero()
    )
    .dividedBy(providers.length);

  // Exact amounts; the presentation layer formats them in the Widget language.
  return {
    monthly: rewardRateAverage.isGreaterThan(0)
      ? rewardAmount.times(rewardRateAverage).dividedBy(12)
      : null,
    rewardRateAverage,
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    yearly: rewardRateAverage.isGreaterThan(0)
      ? rewardAmount.times(rewardRateAverage)
      : null,
  } as const;
};

/**
 * What an amount would earn in USD a year and a month: its USD value at an
 * average reward rate. Null without a priced amount or a positive rate, so
 * no estimate reads as $0. The earn card estimates an entered amount; a
 * position's page, the position's value.
 */
export const getEstimatedRewardsUsd = ({
  amountUsd,
  estimatedRewards,
}: {
  readonly amountUsd: BigNumber | null;
  readonly estimatedRewards: {
    readonly rewardRateAverage: BigNumber;
  } | null;
}) => {
  if (!amountUsd?.isGreaterThan(0) || !estimatedRewards) return null;
  if (!estimatedRewards.rewardRateAverage.isGreaterThan(0)) return null;
  const yearly = amountUsd.times(estimatedRewards.rewardRateAverage);
  return { monthly: yearly.dividedBy(12), yearly } as const;
};
