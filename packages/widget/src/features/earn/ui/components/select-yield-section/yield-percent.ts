import { toChartNumber } from "../../../../../shared/lib/number-format";
import type { YieldRateFigure } from "../../../../yield-summary/index";

/**
 * The yield's reward rate as the Earn form shows it: a ratio to count to, or,
 * for a variable or non-positive rate, the rate figure as it reads.
 */
export type YieldPercent =
  | { readonly _tag: "Rate"; readonly ratio: number }
  | { readonly _tag: "Static"; readonly text: string };

export const getYieldPercent = ({
  rate,
  rateType,
}: {
  /** The yield's rate figure, from its one figures model. */
  readonly rate: YieldRateFigure;
  /** The yield's rate type, such as "variable". */
  readonly rateType: string | null | undefined;
}): YieldPercent =>
  rateType?.toLowerCase() === "variable" || !rate.ratio.isPositive()
    ? { _tag: "Static", text: rate.value }
    : { _tag: "Rate", ratio: toChartNumber(rate.ratio) };
