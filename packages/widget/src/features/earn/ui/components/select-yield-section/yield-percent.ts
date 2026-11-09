import { toChartNumber } from "../../../../../shared/lib/number-format";
import type { YieldRateFigure } from "../../../../yield-summary/index";

/**
 * The yield's reward rate as the Earn form shows it: a ratio to count to, or,
 * for a variable or non-positive rate, the rate figure as it reads.
 */
export type YieldPercent =
  | { readonly _tag: "Rate"; readonly ratio: number }
  | { readonly _tag: "Static"; readonly text: string };

/** The rate figure, from the yield's one figures model, as the form shows it. */
export const getYieldPercent = (rate: YieldRateFigure): YieldPercent =>
  rate.rateType.toLowerCase() === "variable" || !rate.ratio.isPositive()
    ? { _tag: "Static", text: rate.value }
    : { _tag: "Rate", ratio: toChartNumber(rate.ratio) };
