import { exactZero } from "../finance/exact";
import type { YieldCampaign } from "./campaign";
import {
  getRateComposition,
  type RateComposition,
  type RatePart,
  type YieldRewardRate,
} from "./reward-rate";
import type { EarnValidator } from "./validator";

/** Where a position's rate comes from. */
export type PositionRateSources = {
  /** The rate the balances endpoint gives the wallet's position. */
  readonly balanceRewardRate: YieldRewardRate | null;
  /**
   * The Campaign the yield shows: not while Campaigns load, nor once it ends.
   * Asked only of a balance rate with a campaign part.
   */
  readonly getShownCampaign: () => YieldCampaign | null;
  /** The validators the position is staked with; null for a provider's. */
  readonly validators: ReadonlyArray<Pick<EarnValidator, "rewardRate">> | null;
  readonly yieldRewardRate: YieldRewardRate;
};

/**
 * The Position Reward Rate: the summary leads with `headline` and projects
 * it, and Details splits `composition`.
 */
export type PositionRate = {
  readonly headline: RatePart;
  /** The wallet's own rate, not the yield's; its campaign part is exact. */
  readonly personalized: boolean;
  /** Null when there is no campaign part the wallet earns to split out. */
  readonly composition: RateComposition | null;
};

// The Effective Reward Rate of a position staked with validators: the mean of
// those with rates, in the first one's rate type.
const getValidatorsRate = (
  validators: PositionRateSources["validators"]
): RatePart | null => {
  const rated = (validators ?? []).flatMap(({ rewardRate }) =>
    rewardRate
      ? [{ rate: rewardRate.total, rateType: rewardRate.rateType }]
      : []
  );
  const [first] = rated;
  if (!first) return null;
  return {
    rate: rated
      .reduce((total, { rate }) => total.plus(rate), exactZero())
      .dividedBy(rated.length),
    rateType: first.rateType,
  };
};

/**
 * The balance's rate when its campaign part is the wallet's own: only under
 * the shown Campaign's per-wallet cap, since without one every wallet earns
 * the same. Otherwise the validators' mean, which has no composition, or the
 * yield's rate.
 */
const resolvePositionRate = ({
  balanceRewardRate,
  getShownCampaign,
  validators,
  yieldRewardRate,
}: PositionRateSources): PositionRate => {
  const balance = balanceRewardRate
    ? getRateComposition(balanceRewardRate, null)
    : null;
  if (
    balance?.campaign &&
    getShownCampaign()?.qualificationConfig?.maxIncentivizedTvlToken
  ) {
    return {
      headline: balance.total,
      personalized: true,
      composition: balance,
    };
  }

  const yieldRate = getRateComposition(yieldRewardRate, null);
  const validatorsRate = getValidatorsRate(validators);
  if (validatorsRate) {
    return {
      headline: {
        ...validatorsRate,
        rateType: validatorsRate.rateType ?? yieldRate.total.rateType,
      },
      personalized: false,
      composition: null,
    };
  }
  return {
    headline: yieldRate.total,
    personalized: false,
    composition: yieldRate,
  };
};

/** The rate a position leads with, wherever it shows. */
export const getPositionHeadlineRate = (sources: PositionRateSources) =>
  resolvePositionRate(sources).headline;

/**
 * The Position Reward Rate for its page. Details splits the wallet's own
 * rate, or the yield's when the wallet can earn its campaign part ("up to"
 * it); a validators' mean is not split.
 */
export const getPositionRate = ({
  canEarnCampaign,
  ...sources
}: PositionRateSources & {
  /**
   * False below the campaign's minimum or for an excluded wallet. Asked only
   * of a yield rate with a campaign part.
   */
  readonly canEarnCampaign: () => boolean;
}): PositionRate => {
  const rate = resolvePositionRate(sources);
  return rate.personalized || (rate.composition?.campaign && canEarnCampaign())
    ? rate
    : { ...rate, composition: null };
};
