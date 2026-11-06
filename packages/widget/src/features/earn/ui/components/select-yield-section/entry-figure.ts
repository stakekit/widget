import type BigNumber from "bignumber.js";
import {
  formatTokenAmount,
  unavailableFigure,
  withFigureUnit,
} from "../../../../../shared/lib/number-format";

/**
 * A figure computed from the entered amount, such as the amount received or
 * the estimated rewards: unavailable until the user enters an amount, so an
 * empty input never reads as 0. The unit follows a computed figure only, so
 * the placeholder reads "—" rather than "— ETH".
 */
export const formatEntryFigure = ({
  amount,
  amountEntered,
  locale,
  unit,
}: {
  readonly amount: BigNumber | null;
  readonly amountEntered: boolean;
  readonly locale: string;
  readonly unit?: string;
}) => {
  if (!amountEntered || !amount) return unavailableFigure;
  const figure = formatTokenAmount(amount, locale, "nearest");
  return unit ? withFigureUnit(figure, unit) : figure;
};
