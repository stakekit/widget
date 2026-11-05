import type BigNumber from "bignumber.js";
import {
  formatTokenAmount,
  unavailableFigure,
} from "../../../../../shared/lib/number-format";

/**
 * A figure computed from the entered amount, such as the amount received or
 * the estimated rewards: unavailable until the user enters an amount, so an
 * empty input never reads as 0.
 */
export const formatEntryFigure = ({
  amount,
  amountEntered,
  locale,
}: {
  readonly amount: BigNumber | null;
  readonly amountEntered: boolean;
  readonly locale: string;
}) =>
  amountEntered && amount
    ? formatTokenAmount(amount, locale, "nearest")
    : unavailableFigure;
