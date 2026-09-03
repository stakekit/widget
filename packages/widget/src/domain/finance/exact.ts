import BigNumber from "bignumber.js";
import "./config";

export const exactDecimal = (value: string | number | BigNumber): BigNumber =>
  BigNumber.isBigNumber(value) ? value : new BigNumber(value);

export const exactZero = (): BigNumber => new BigNumber(0);

export const sumExact = (values: ReadonlyArray<BigNumber>): BigNumber =>
  values.reduce((total, value) => total.plus(value), exactZero());

export const truncateToTokenDecimals = (
  amount: BigNumber,
  decimals: number
): BigNumber => amount.decimalPlaces(decimals, BigNumber.ROUND_DOWN);

export const toSafeIntegerCount = (value: BigNumber): number | null => {
  if (!value.isFinite() || !value.isInteger()) return null;

  const count = Number(value.toFixed(0));

  return Number.isSafeInteger(count) ? count : null;
};
