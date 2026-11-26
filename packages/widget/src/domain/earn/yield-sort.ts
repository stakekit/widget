import {
  getYieldRiskDisplay,
  getYieldTvlUsd,
  isNonZeroRewardRateYield,
} from "./yield";
import type { EarnYieldWithProvider } from "./yield-schema";

/**
 * How the yield list is ordered: `recommended` keeps the Earn Selection's
 * order; the others list the highest reward rate, the highest TVL or the
 * least risky rating first.
 */
export const yieldSorts = ["recommended", "rewardRate", "tvl", "risk"] as const;

export type YieldSort = (typeof yieldSorts)[number];

/**
 * Each rater's grades on one 1 (least risky) to 5 scale, so ratings from
 * different raters compare. A copy of the backend's risk score map, until the
 * API sends the score.
 */
const riskScores: Readonly<Record<string, Readonly<Record<string, number>>>> = {
  credora: {
    "A+": 1,
    A: 1,
    "A-": 2,
    "B+": 2,
    B: 3,
    "B-": 3,
    "C+": 4,
    C: 4,
    "C-": 5,
    D: 5,
    F: 5,
  },
  stakingRewards: {
    AAA: 1,
    "AA+": 1,
    AA: 1,
    "AA-": 1,
    "A+": 1,
    A: 1,
    "A-": 2,
    "BBB+": 2,
    BBB: 2,
    "BBB-": 3,
    "BB+": 3,
    BB: 3,
    "BB-": 4,
    "B+": 4,
    B: 4,
    "B-": 5,
    "CCC+": 5,
    CCC: 5,
    "CCC-": 5,
    "CC+": 5,
    CC: 5,
    "CC-": 5,
    "C+": 5,
    C: 5,
    "C-": 5,
    D: 5,
    F: 5,
  },
};

/** The score of the rating the yield shows; null when unrated or unscored. */
const getYieldRiskScore = (yieldDto: EarnYieldWithProvider): number | null => {
  const risk = getYieldRiskDisplay(yieldDto);
  if (!risk) return null;
  return riskScores[risk.source]?.[risk.rating.toUpperCase()] ?? null;
};

/**
 * The reward rate the yield shows; null where it shows none, as for a zero
 * rate outside the yields known to pay one.
 */
const getShownRewardRate = (yieldDto: EarnYieldWithProvider) => {
  const { total } = yieldDto.rewardRate;
  if (!total.isFinite()) return null;
  return total.isZero() && !isNonZeroRewardRateYield(yieldDto) ? null : total;
};

/**
 * Orders a pair by `firstBefore`, which is negative when its first value
 * comes first; a missing value goes last.
 */
const missingLast = <Value>(
  left: Value | null,
  right: Value | null,
  firstBefore: (left: Value, right: Value) => number
) => {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return firstBefore(left, right);
};

const comparators: Record<
  Exclude<YieldSort, "recommended">,
  (left: EarnYieldWithProvider, right: EarnYieldWithProvider) => number
> = {
  rewardRate: (left, right) =>
    missingLast(
      getShownRewardRate(left),
      getShownRewardRate(right),
      (leftRate, rightRate) => rightRate.comparedTo(leftRate) ?? 0
    ),
  tvl: (left, right) =>
    missingLast(
      getYieldTvlUsd(left) ?? null,
      getYieldTvlUsd(right) ?? null,
      (leftTvl, rightTvl) => rightTvl.comparedTo(leftTvl) ?? 0
    ),
  // A lower score is less risky.
  risk: (left, right) =>
    missingLast(
      getYieldRiskScore(left),
      getYieldRiskScore(right),
      (leftScore, rightScore) => leftScore - rightScore
    ),
};

/**
 * The yields in `sort` order. Yields that tie, or that both lack the value,
 * keep their given order.
 */
export const sortYields = <Yield extends EarnYieldWithProvider>(
  yields: ReadonlyArray<Yield>,
  sort: YieldSort
): Yield[] =>
  sort === "recommended" ? [...yields] : yields.toSorted(comparators[sort]);
