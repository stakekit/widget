import { toChartNumber } from "../../../../../shared/lib/number-format";
import type { getYieldEstimatedRewards } from "../../../../yield-summary/index";

type EstimatedRewards = ReturnType<typeof getYieldEstimatedRewards>;

/**
 * The yield's reward rate as the Earn form shows it: a ratio to count to, or
 * "- %" for a variable or non-positive rate, which has no figure to show.
 */
export type YieldPercent =
  | { readonly _tag: "Rate"; readonly ratio: number }
  | { readonly _tag: "Unknown" };

export const getYieldPercent = (
  estimatedRewards: EstimatedRewards
): YieldPercent | null => {
  if (!estimatedRewards) return null;

  if (
    estimatedRewards.rewardType === "variable" ||
    !estimatedRewards.rewardRateAverage.isPositive()
  ) {
    return { _tag: "Unknown" };
  }

  return {
    _tag: "Rate",
    ratio: toChartNumber(estimatedRewards.rewardRateAverage),
  };
};
