import type BigNumber from "bignumber.js";
import { Array as EArray, Option } from "effect";

import {
  type CampaignAtTime,
  getCampaignRewardsEstimate,
} from "../../../domain/earn/campaign";
import { getRateComposition } from "../../../domain/earn/reward-rate";
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
  campaign,
  providers,
  validators,
  yield: selectedYield,
}: {
  readonly amount: BigNumber;
  /** The yield's campaign; its rules limit the campaign part of the rate. */
  readonly campaign: CampaignAtTime | null;
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
  const campaignEstimate = campaign
    ? getCampaignRewardsEstimate({
        amount: rewardAmount,
        campaign: campaign.campaign,
        // The yield's rate already has its earning campaign's part.
        campaignIncentiveRate:
          getRateComposition(selectedYield.rewardRate, null).campaign?.rate ??
          exactZero(),
        now: campaign.now,
        rewardRate: rewardRateAverage,
      })
    : null;
  const hasRate = rewardRateAverage.isGreaterThan(0);

  // Exact amounts; the presentation layer formats them in the Widget language.
  return {
    amount: rewardAmount,
    monthly:
      campaignEstimate?.monthly ??
      (hasRate ? rewardAmount.times(rewardRateAverage).dividedBy(12) : null),
    rewardRateAverage,
    rewardType: selectedYield.rewardRate.rateType?.toLowerCase(),
    yearly:
      campaignEstimate?.yearly ??
      (hasRate ? rewardAmount.times(rewardRateAverage) : null),
  } as const;
};

/**
 * What an amount would earn in USD a year and a month. With token estimates
 * of `amount`, their share of it, so campaign rules count in USD too;
 * otherwise the USD value at the average reward rate. Null without a priced
 * amount or a positive rate, so no estimate reads as $0. The earn card
 * estimates an entered amount; a position's page, the position's value.
 */
export const getEstimatedRewardsUsd = ({
  amountUsd,
  estimatedRewards,
}: {
  readonly amountUsd: BigNumber | null;
  readonly estimatedRewards: {
    readonly rewardRateAverage: BigNumber;
    readonly amount?: BigNumber;
    readonly monthly?: BigNumber | null;
    readonly yearly?: BigNumber | null;
  } | null;
}) => {
  if (!amountUsd?.isGreaterThan(0) || !estimatedRewards) return null;
  if (!estimatedRewards.rewardRateAverage.isGreaterThan(0)) return null;
  const { amount, monthly, yearly } = estimatedRewards;
  if (amount?.isGreaterThan(0) && monthly && yearly) {
    const usdPerToken = amountUsd.dividedBy(amount);
    return {
      monthly: monthly.times(usdPerToken),
      yearly: yearly.times(usdPerToken),
    } as const;
  }
  const yearlyUsd = amountUsd.times(estimatedRewards.rewardRateAverage);
  return { monthly: yearlyUsd.dividedBy(12), yearly: yearlyUsd } as const;
};
