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
 * The reward rate the yield shows; null where it shows none, as for a zero
 * rate outside the yields known to pay one.
 */
const getShownRewardRate = (yieldDto: EarnYieldWithProvider) => {
  const { total } = yieldDto.rewardRate;
  if (!total.isFinite()) return null;
  return total.isZero() && !isNonZeroRewardRateYield(yieldDto) ? null : total;
};

/** The TVL the yield shows; null where it shows none, as for a zero TVL. */
const getShownTvlUsd = (yieldDto: EarnYieldWithProvider) => {
  const tvl = getYieldTvlUsd(yieldDto);
  return tvl?.isGreaterThan(0) ? tvl : null;
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

/** A sort that reorders the yields: every sort but the recommended order. */
type ReorderingYieldSort = Exclude<YieldSort, "recommended">;

const comparators: Record<
  ReorderingYieldSort,
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
      getShownTvlUsd(left),
      getShownTvlUsd(right),
      (leftTvl, rightTvl) => rightTvl.comparedTo(leftTvl) ?? 0
    ),
  // A lower Risk Score is less risky; the unrated and unscored go last.
  risk: (left, right) =>
    missingLast(
      getYieldRiskDisplay(left)?.score ?? null,
      getYieldRiskDisplay(right)?.score ?? null,
      (leftScore, rightScore) => leftScore - rightScore
    ),
};

/**
 * The yields in `sort` order. Yields that tie, or that both lack the value,
 * keep their given order.
 */
export const sortYields = <Yield extends EarnYieldWithProvider>(
  yields: ReadonlyArray<Yield>,
  sort: ReorderingYieldSort
): Yield[] => yields.toSorted(comparators[sort]);
