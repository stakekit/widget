import BigNumber from "bignumber.js";
import { exactDecimal } from "../../domain/finance/exact";

/**
 * Formats a number for display. With `decimals`, the value is truncated
 * (ROUND_DOWN) to that many places; a non-zero value that truncates to zero is
 * shown as below the smallest unit at that precision (`<0.000001`,
 * `>-0.000001`) instead of its full dust digits. Without `decimals`, the exact
 * value is formatted.
 */
export const formatNumber = (
  number: string | BigNumber | number,
  decimals?: number
) => {
  const value = exactDecimal(number);

  if (typeof decimals !== "number") return value.toFormat();

  const truncated = value.decimalPlaces(decimals, BigNumber.ROUND_DOWN);

  if (decimals <= 0 || value.isZero() || !truncated.isZero()) {
    return truncated.toFormat();
  }

  const smallestUnit = exactDecimal(1).shiftedBy(-decimals);

  return value.isNegative()
    ? `>${smallestUnit.negated().toFormat()}`
    : `<${smallestUnit.toFormat()}`;
};

export const defaultFormattedNumber = (number: string | BigNumber | number) =>
  formatNumber(number, 6);

export const toRepresentationNumber = (
  value: BigNumber | number | string
): number => exactDecimal(value).toNumber();

export const toChartNumber = toRepresentationNumber;
