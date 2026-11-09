import type BigNumber from "bignumber.js";

import { exactDecimal, exactZero } from "../../domain/finance/exact";
import { getLocaleNumberSymbols } from "./number-format";

/**
 * Maps exact amounts onto the Design System's `AmountInput`/`AmountPanel`,
 * which take an amount as a plain decimal string (ADR 0006).
 */

/** The decimal and grouping separators an amount is typed in for `locale`. */
export const amountSeparators = (locale: string) => {
  const { decimal, group } = getLocaleNumberSymbols(locale);
  return { decimal, group };
};

/** An exact amount as the decimal string an amount input takes. */
export const toAmountValue = (amount: BigNumber): string =>
  amount.isFinite() ? amount.toFixed() : "";

/** The decimal string an amount input gives back, as an exact amount. */
export const fromAmountValue = (value: string): BigNumber =>
  value === "" ? exactZero() : exactDecimal(value);
