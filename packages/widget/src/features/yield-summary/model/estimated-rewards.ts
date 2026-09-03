import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../domain/earn/models";
import type { ValidatorKey } from "../../../domain/earn/validator";
import { isBittensorStaking } from "../../../domain/earn/yield";
import { exactDecimal, exactZero } from "../../../domain/finance/exact";
import { getRewardRateFormatted } from "../../../shared/lib/formatters";
import { formatNumber } from "../../../shared/lib/number-format";

type YieldRewardProvider = Readonly<{
  readonly rewardRate?: BigNumber | number | null;
}>;

export const getYieldEstimatedRewards = ({
  amount,
  providers,
  validators,
  yield: selectedYield,
}: {
  readonly amount: BigNumber;
  readonly providers: ReadonlyArray<YieldRewardProvider> | null;
  readonly validators: ReadonlyMap<ValidatorKey, EarnValidator>;
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

  return {
    monthly: rewardRateAverage.isGreaterThan(0)
      ? formatNumber(
          rewardAmount.times(rewardRateAverage).dividedBy(12).decimalPlaces(5)
        )
      : "-",
    percentage: getRewardRateFormatted({
      rewardRate: rewardRateAverage,
    }),
    rewardRateAverage,
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    yearly: rewardRateAverage.isGreaterThan(0)
      ? formatNumber(rewardAmount.times(rewardRateAverage).decimalPlaces(5))
      : "-",
  } as const;
};
