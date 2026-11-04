import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import type {
  EarnValidator,
  EarnValidatorKey,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import { isBittensorStaking } from "../../../domain/earn/yield";
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
      ? rewardAmount.times(rewardRateAverage).dividedBy(12).decimalPlaces(5)
      : null,
    rewardRateAverage,
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    yearly: rewardRateAverage.isGreaterThan(0)
      ? rewardAmount.times(rewardRateAverage).decimalPlaces(5)
      : null,
  } as const;
};
