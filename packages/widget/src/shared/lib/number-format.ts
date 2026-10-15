import BigNumber from "bignumber.js";
import { exactDecimal } from "../../domain/finance/exact";

/**
 * The only display formatter for numbers. Every function takes the Widget
 * language explicitly. Truncation and rounding happen in exact decimal
 * arithmetic; the locale only supplies separators and affixes, and Intl only
 * renders currency and compact notation after the exact work is done.
 */

type NumericValue = string | BigNumber | number;
type OptionalNumericValue = NumericValue | null | undefined;

type LocaleNumberSymbols = {
  readonly decimal: string;
  readonly group: string;
  readonly percentPrefix: string;
  readonly percentSuffix: string;
};

const numericPartTypes: Partial<Record<string, true>> = {
  integer: true,
  group: true,
  decimal: true,
  fraction: true,
  minusSign: true,
  plusSign: true,
};

const localeNumberSymbols = new Map<string, LocaleNumberSymbols>();

export const getLocaleNumberSymbols = (locale: string): LocaleNumberSymbols => {
  const cached = localeNumberSymbols.get(locale);
  if (cached) return cached;

  const parts = new Intl.NumberFormat(locale).formatToParts(12_345.6);
  const percentParts = new Intl.NumberFormat(locale, {
    style: "percent",
  }).formatToParts(0.5);
  const firstNumeric = percentParts.findIndex(
    (part) => numericPartTypes[part.type]
  );
  const lastNumeric = percentParts.findLastIndex(
    (part) => numericPartTypes[part.type]
  );
  const join = (from: number, to: number) =>
    percentParts
      .slice(from, to)
      .map((part) => part.value)
      .join("");

  const symbols = {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    percentPrefix: firstNumeric < 0 ? "" : join(0, firstNumeric),
    percentSuffix:
      lastNumeric < 0 ? "%" : join(lastNumeric + 1, Number.POSITIVE_INFINITY),
  };
  localeNumberSymbols.set(locale, symbols);
  return symbols;
};

const formatExact = (value: BigNumber, locale: string) => {
  const { decimal, group } = getLocaleNumberSymbols(locale);

  return value.toFormat({
    decimalSeparator: decimal,
    groupSeparator: group,
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: "",
    fractionGroupSize: 0,
  });
};

/**
 * Formats a number for display. With `decimals`, the value is truncated
 * (ROUND_DOWN) to that many places; a non-zero value that truncates to zero is
 * shown as below the smallest unit at that precision (`<0.000001`,
 * `>-0.000001`) instead of its full dust digits. Without `decimals`, the exact
 * value is formatted.
 */
export const formatNumber = (
  number: NumericValue,
  locale: string,
  decimals?: number
) => {
  const value = exactDecimal(number);

  if (typeof decimals !== "number") return formatExact(value, locale);

  const truncated = value.decimalPlaces(decimals, BigNumber.ROUND_DOWN);

  if (decimals <= 0 || value.isZero() || !truncated.isZero()) {
    return formatExact(truncated, locale);
  }

  const smallestUnit = exactDecimal(1).shiftedBy(-decimals);

  return value.isNegative()
    ? `>${formatExact(smallestUnit.negated(), locale)}`
    : `<${formatExact(smallestUnit, locale)}`;
};

/** Token amounts: six decimals, truncated, with the dust marker. */
export const formatTokenAmount = (number: NumericValue, locale: string) =>
  formatNumber(number, locale, 6);

const isMissingNumericInput = (
  value: OptionalNumericValue
): value is null | undefined | "" => value == null || value === "";

const toFiniteDecimal = (value: OptionalNumericValue): BigNumber | null => {
  if (isMissingNumericInput(value)) return null;

  const amount = exactDecimal(value);

  return amount.isFinite() ? amount : null;
};

const intlFormatOptions = {
  usd: {
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  },
  "compact-usd": {
    currency: "USD",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    notation: "compact",
    style: "currency",
  },
  compact: {
    notation: "compact",
    maximumFractionDigits: 0,
  },
} satisfies Record<string, Intl.NumberFormatOptions>;

const intlFormatters = new Map<string, Intl.NumberFormat>();

const getIntlFormatter = (
  kind: keyof typeof intlFormatOptions,
  locale: string
) => {
  const key = `${kind}:${locale}`;
  const cached = intlFormatters.get(key);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale, intlFormatOptions[kind]);
  intlFormatters.set(key, formatter);
  return formatter;
};

export const formatCompactNumber = (
  value: OptionalNumericValue,
  locale: string
) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return "-";

  return getIntlFormatter("compact", locale).format(amount.toNumber());
};

const minimumUsd = exactDecimal("0.01");

export const formatUsd = (value: OptionalNumericValue, locale: string) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return "-";

  const usd = getIntlFormatter("usd", locale);

  if (amount.isZero()) return usd.format(0);

  const absoluteAmount = amount.abs();

  if (absoluteAmount.lt(minimumUsd)) {
    return amount.isNegative()
      ? `>${usd.format(minimumUsd.negated().toNumber())}`
      : `<${usd.format(minimumUsd.toNumber())}`;
  }

  return absoluteAmount.lt(1000)
    ? usd.format(amount.decimalPlaces(2, BigNumber.ROUND_HALF_UP).toNumber())
    : getIntlFormatter("compact-usd", locale).format(amount.toNumber());
};

const withPercentAffixes = (formatted: string, locale: string) => {
  const { percentPrefix, percentSuffix } = getLocaleNumberSymbols(locale);

  return `${percentPrefix}${formatted}${percentSuffix}`;
};

/**
 * Formats a decimal ratio (e.g. 0.75) as a percent (e.g. "75%"), truncated to
 * two places with the below-smallest-unit marker.
 */
export const formatPercent = (value: OptionalNumericValue, locale: string) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return "-";

  return withPercentAffixes(formatNumber(amount.times(100), locale, 2), locale);
};

/**
 * Formats a decimal ratio as a percent rounded half-up to two places, used for
 * reward rates and commissions.
 */
export const formatRoundedPercent = (value: NumericValue, locale: string) =>
  withPercentAffixes(
    formatNumber(exactDecimal(value).times(100).decimalPlaces(2), locale),
    locale
  );

/** Formats a decimal ratio as its exact percent, used for fee percentages. */
export const formatExactPercent = (value: NumericValue, locale: string) =>
  withPercentAffixes(
    formatNumber(exactDecimal(value).times(100), locale),
    locale
  );

/** Reward rates of zero or unknown read as unavailable. */
export const formatRewardRatePercent = (
  rewardRate: BigNumber | number | undefined,
  locale: string
) =>
  rewardRate == null || exactDecimal(rewardRate).isZero()
    ? "- %"
    : formatRoundedPercent(rewardRate, locale);

/** LTV past 100% means debt exceeds collateral; the exact figure adds nothing. */
export const formatLtv = (value: OptionalNumericValue, locale: string) => {
  if (isMissingNumericInput(value)) return "-";

  return exactDecimal(value).gt(1)
    ? `>${withPercentAffixes(formatNumber(100, locale), locale)}`
    : formatPercent(value, locale);
};

const minimumHealthFactor = exactDecimal("0.01");

export const formatHealthFactor = (
  value: OptionalNumericValue,
  locale: string
) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return "-";

  if (amount.gt(0) && amount.lt(minimumHealthFactor)) {
    return `<${formatNumber(minimumHealthFactor, locale)}`;
  }

  return formatNumber(amount, locale, 4);
};

export const toRepresentationNumber = (
  value: BigNumber | number | string
): number => exactDecimal(value).toNumber();

export const toChartNumber = toRepresentationNumber;
