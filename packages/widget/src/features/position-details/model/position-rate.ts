import type BigNumber from "bignumber.js";

import {
  getRateComposition,
  type RateComposition,
  type RatePart,
  type YieldRewardRate,
} from "../../../domain/earn/reward-rate";
import { exactZero } from "../../../domain/finance/exact";

/** The validators a position is staked with, by their reward rates. */
export type PositionValidators = ReadonlyArray<{
  readonly rewardRate?: BigNumber | null | undefined;
  /** The rate's type, such as "apy". */
  readonly rewardType?: string | undefined;
}>;

export type PositionRateInput = {
  /** The rate the balances endpoint gives the wallet's position. */
  readonly balanceRewardRate: YieldRewardRate | null;
  /**
   * Whether the balance's campaign part can be the wallet's own: false for a
   * campaign without a per-wallet cap, where every wallet earns the same.
   * Asked only of a balance rate with a campaign part.
   */
  readonly balanceRateIsPersonal: () => boolean;
  /**
   * False below the campaign's minimum or for an excluded wallet. Asked only
   * of a yield rate with a campaign part.
   */
  readonly canEarnCampaign: () => boolean;
  /** Null for a position held with the yield's provider. */
  readonly validators: PositionValidators | null;
  readonly yieldRewardRate: YieldRewardRate;
};

/**
 * The one rate a position shows: the summary leads with `headline` and
 * projects it, and Details splits `composition`.
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
  validators: PositionValidators | null
): RatePart | null => {
  const rated = (validators ?? []).flatMap(({ rewardRate, rewardType }) =>
    rewardRate ? [{ rate: rewardRate, rateType: rewardType }] : []
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
 * The wallet's own rate when the balance's campaign part is personal;
 * otherwise the validators' mean, or the yield's rate with its composition
 * when the wallet earns its campaign part ("up to" it). Details splits only
 * the rate the summary leads with, so a validators' mean has no composition.
 */
export const getPositionRate = ({
  balanceRewardRate,
  balanceRateIsPersonal,
  canEarnCampaign,
  validators,
  yieldRewardRate,
}: PositionRateInput): PositionRate => {
  const balance = balanceRewardRate
    ? getRateComposition(balanceRewardRate)
    : null;
  if (balance?.campaign && balanceRateIsPersonal()) {
    return {
      headline: balance.total,
      personalized: true,
      composition: balance,
    };
  }

  const yieldRate = getRateComposition(yieldRewardRate);
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
    composition: yieldRate.campaign && canEarnCampaign() ? yieldRate : null,
  };
};
