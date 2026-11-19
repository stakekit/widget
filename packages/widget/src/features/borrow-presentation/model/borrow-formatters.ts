import type BigNumber from "bignumber.js";

import { exactDecimal } from "../../../domain/finance/exact";
import {
  formatAbbreviatedDown,
  formatNumber,
  formatPercent,
  unavailableFigure,
} from "../../../shared/lib/number-format";

type OptionalNumericValue = BigNumber | number | string | null | undefined;

/** A borrow integration's name without its trailing "Borrow". */
export const formatBorrowProviderName = (providerName: string) =>
  providerName.replace(/\s+borrow$/iu, "");

/** LTV past 100% means debt exceeds collateral; the exact figure adds nothing. */
export const formatLtv = (value: OptionalNumericValue, locale: string) =>
  value != null && value !== "" && exactDecimal(value).gt(1)
    ? `>${formatPercent(1, locale)}`
    : formatPercent(value, locale);

const healthFactorDecimals = 2;
const minimumHealthFactor = exactDecimal(1).shiftedBy(-healthFactorDecimals);
const abbreviatedHealthFactor = exactDecimal(1000);

/**
 * Truncated to two places, never rounded up: 0.996 must not read as a safe
 * "1.00". From 1,000 up the digits only restate "far from liquidation" (dust
 * debt reads in the millions), so it goes abbreviated ("1K", "2.22M").
 */
export const formatHealthFactor = (
  value: OptionalNumericValue,
  locale: string
) => {
  if (value == null || value === "") return unavailableFigure;

  const amount = exactDecimal(value);
  if (!amount.isFinite()) return unavailableFigure;

  if (amount.gt(0) && amount.lt(minimumHealthFactor)) {
    return `<${formatNumber(minimumHealthFactor, locale)}`;
  }

  return amount.gte(abbreviatedHealthFactor)
    ? formatAbbreviatedDown(amount, locale)
    : formatNumber(amount, locale, healthFactorDecimals);
};
