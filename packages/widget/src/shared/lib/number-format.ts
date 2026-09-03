import BigNumber from "bignumber.js";
import { exactDecimal } from "../../domain/finance/exact";

export const formatNumber = (
  number: string | BigNumber | number,
  decimals?: number
) => {
  const value = exactDecimal(number);

  const formatted = (() => {
    if (typeof decimals !== "number") return value;

    const formattedValue = value.decimalPlaces(decimals, BigNumber.ROUND_DOWN);

    return decimals > 0 && !value.isZero() && formattedValue.isZero()
      ? value.precision(decimals, BigNumber.ROUND_DOWN)
      : formattedValue;
  })();
  return formatted.toFormat();
};

export const defaultFormattedNumber = (number: string | BigNumber | number) =>
  formatNumber(number, 6);

export const toRepresentationNumber = (
  value: BigNumber | number | string
): number => exactDecimal(value).toNumber();

export const toChartNumber = toRepresentationNumber;
