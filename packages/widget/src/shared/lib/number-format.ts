import BigNumber from "bignumber.js";
import { exactDecimal } from "../../domain/finance/exact";

/**
 * The only display formatter for numbers. Every function takes the Widget
 * language explicitly. Truncation and rounding happen in exact decimal
 * arithmetic; the locale only supplies separators and affixes, and Intl only
 * renders currency and compact notation after the exact work is done.
 * Negative figures read with the minus sign (U+2212), and a figure that is
 * unknown or unavailable reads as `unavailableFigure`.
 */

type NumericValue = string | BigNumber | number;
type OptionalNumericValue = NumericValue | null | undefined;

/** What every formatter shows for a figure that is unknown or unavailable. */
export const unavailableFigure = "—";

/** Typographic minus sign in place of the hyphen-minus formatters emit. */
const withMinusSign = (formatted: string) => formatted.replace("-", "\u2212");

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

const formatExact = (
  value: BigNumber,
  locale: string,
  fixedDecimals?: number
) => {
  const { decimal, group } = getLocaleNumberSymbols(locale);
  const format = {
    decimalSeparator: decimal,
    groupSeparator: group,
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: "",
    fractionGroupSize: 0,
  };
  return withMinusSign(
    fixedDecimals === undefined
      ? value.toFormat(format)
      : value.toFormat(fixedDecimals, BigNumber.ROUND_HALF_UP, format)
  );
};

/**
 * Formats a number for display. With `decimals`, the value is truncated
 * (ROUND_DOWN) to that many places; a non-zero value that truncates to zero is
 * shown as below the smallest unit at that precision (`<0.000001`,
 * `>−0.000001`) instead of its full dust digits. Without `decimals`, the exact
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

/**
 * Which way a token amount may move for display. `down` for amounts the user
 * holds or moves (never overstate what Max fills), `up` for minimums, debt and
 * fees (never understate what is owed), `nearest` for estimates.
 */
export type TokenAmountRounding = "down" | "up" | "nearest";

const tokenAmountRoundingModes = {
  down: BigNumber.ROUND_DOWN,
  nearest: BigNumber.ROUND_HALF_UP,
  up: BigNumber.ROUND_UP,
} satisfies Record<TokenAmountRounding, BigNumber.RoundingMode>;

const tokenAmountDecimals = 4;
const tokenAmountFloor = exactDecimal(1).shiftedBy(-tokenAmountDecimals);

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
  "compact-health-factor": {
    notation: "compact",
    maximumFractionDigits: 2,
    roundingMode: "trunc",
  },
  "compact-token-amount-down": {
    notation: "compact",
    maximumFractionDigits: 2,
    roundingMode: "trunc",
  },
  "compact-token-amount-up": {
    notation: "compact",
    maximumFractionDigits: 2,
    roundingMode: "expand",
  },
  "compact-token-amount-nearest": {
    notation: "compact",
    maximumFractionDigits: 2,
    roundingMode: "halfExpand",
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
  if (!amount) return unavailableFigure;

  return withMinusSign(
    getIntlFormatter("compact", locale).format(amount.toNumber())
  );
};

/** From here amounts and USD values read in compact notation ("1.2M"). */
const compactFloor = exactDecimal(1_000_000);

/**
 * Token amounts with at most four decimals, trailing zeros dropped, grouped in
 * full below 1,000,000 ("1,762.3456") and in compact notation from 1,000,000
 * ("1.2M"); a non-zero amount below 0.0001 reads `<0.0001` (`>−0.0001` when
 * negative), never 0, whichever way it rounds. Display only; state keeps the
 * exact amount.
 */
export const formatTokenAmount = (
  number: NumericValue,
  locale: string,
  rounding: TokenAmountRounding
) => {
  const value = exactDecimal(number);

  if (value.isZero()) return formatExact(value, locale);
  if (value.abs().lt(tokenAmountFloor)) {
    return formatNumber(value, locale, tokenAmountDecimals);
  }

  const rounded = value.decimalPlaces(
    tokenAmountDecimals,
    tokenAmountRoundingModes[rounding]
  );

  if (rounded.abs().lt(compactFloor)) return formatExact(rounded, locale);

  return withMinusSign(
    getIntlFormatter(`compact-token-amount-${rounding}`, locale).format(
      value.toNumber()
    )
  );
};

/** A token amount, rounded down, followed by its token's symbol. */
export const formatTokenAmountWithSymbol = (
  tokenAmount: Readonly<{
    readonly amount: NumericValue;
    readonly token: Readonly<{ readonly symbol: string }>;
  }>,
  locale: string
) =>
  `${formatTokenAmount(tokenAmount.amount, locale, "down")} ${tokenAmount.token.symbol}`;

/**
 * A figure followed by its unit, such as "1.5 ETH". An unknown figure reads
 * as the placeholder alone, "—" rather than "— ETH".
 */
export const withFigureUnit = (
  figure: string | null | undefined,
  unit: string
) =>
  !figure || figure === unavailableFigure
    ? unavailableFigure
    : `${figure} ${unit}`;

const minimumUsd = exactDecimal("0.01");

/**
 * USD values exact to the cent below 1,000,000 ("$1,710.42") and in compact
 * notation from 1,000,000 ("$1.23M"); a non-zero value below a cent reads
 * `<$0.01`.
 */
export const formatUsd = (value: OptionalNumericValue, locale: string) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return unavailableFigure;

  const usd = getIntlFormatter("usd", locale);

  if (amount.isZero()) return usd.format(0);

  const absoluteAmount = amount.abs();

  if (absoluteAmount.lt(minimumUsd)) {
    return amount.isNegative()
      ? withMinusSign(`>${usd.format(minimumUsd.negated().toNumber())}`)
      : `<${usd.format(minimumUsd.toNumber())}`;
  }

  const cents = amount.decimalPlaces(2, BigNumber.ROUND_HALF_UP);

  return withMinusSign(
    cents.abs().lt(compactFloor)
      ? usd.format(cents.toNumber())
      : getIntlFormatter("compact-usd", locale).format(amount.toNumber())
  );
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
  if (!amount) return unavailableFigure;

  return withPercentAffixes(formatNumber(amount.times(100), locale, 2), locale);
};

/** The percent of a decimal ratio, rounded half-up to two places. */
const roundedPercent = (value: NumericValue) =>
  exactDecimal(value).times(100).decimalPlaces(2);

/**
 * Formats a decimal ratio as a percent rounded half-up to two places, used for
 * reward rates and commissions. A non-zero ratio that rounds to zero reads
 * `<0.01%` (`>−0.01%` when negative), so no rate that exists reads as 0%.
 */
export const formatRoundedPercent = (value: NumericValue, locale: string) => {
  const exact = exactDecimal(value);
  const rounded = roundedPercent(exact);

  if (!exact.isZero() && rounded.isZero()) {
    return exact.isNegative()
      ? `>${withPercentAffixes(formatExact(exactDecimal("-0.01"), locale), locale)}`
      : `<${withPercentAffixes(formatExact(exactDecimal("0.01"), locale), locale)}`;
  }

  return withPercentAffixes(formatNumber(rounded, locale), locale);
};

/**
 * `formatRoundedPercent` of `target` split as `AnimatedNumber`'s props for a
 * figure that counts to it: the percent affixes stay apart, and `format`
 * keeps every step to the target's decimal places, so the digits change count
 * only when the integer part does and the last step reads exactly as the
 * target.
 */
export const getRoundedPercentParts = (target: number, locale: string) => {
  const { percentPrefix, percentSuffix } = getLocaleNumberSymbols(locale);
  const decimals = roundedPercent(target).decimalPlaces() ?? 0;

  return {
    prefix: percentPrefix,
    suffix: percentSuffix,
    format: (value: number) =>
      formatExact(roundedPercent(value), locale, decimals),
  };
};

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
    ? unavailableFigure
    : formatRoundedPercent(rewardRate, locale);

/** LTV past 100% means debt exceeds collateral; the exact figure adds nothing. */
export const formatLtv = (value: OptionalNumericValue, locale: string) => {
  if (isMissingNumericInput(value)) return unavailableFigure;

  return exactDecimal(value).gt(1)
    ? `>${withPercentAffixes(formatNumber(100, locale), locale)}`
    : formatPercent(value, locale);
};

const healthFactorDecimals = 2;
const minimumHealthFactor = exactDecimal(1).shiftedBy(-healthFactorDecimals);
const compactHealthFactor = exactDecimal(1000);

/**
 * Truncated to two places, never rounded up: 0.996 must not read as a safe
 * "1.00". From 1,000 up the digits only restate "far from liquidation" (dust
 * debt reads in the millions), so it goes compact.
 */
export const formatHealthFactor = (
  value: OptionalNumericValue,
  locale: string
) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return unavailableFigure;

  if (amount.gt(0) && amount.lt(minimumHealthFactor)) {
    return `<${formatNumber(minimumHealthFactor, locale)}`;
  }

  if (amount.gte(compactHealthFactor)) {
    // Compact shows at most tens of the integer part; truncate exactly first
    // so the float conversion cannot round up across a unit boundary.
    return getIntlFormatter("compact-health-factor", locale).format(
      amount.decimalPlaces(0, BigNumber.ROUND_DOWN).toNumber()
    );
  }

  return formatNumber(amount, locale, healthFactorDecimals);
};

/**
 * A figure as it moves with an action: `before → after`, or just `after` when
 * `before` is unknown or, unless `showWhenEqual`, the two match. An
 * unavailable `after` formats to null.
 */
export const formatFigureChange = <Value>(
  format: (value: Value, locale: string) => string,
  figure: { readonly after: Value; readonly before: Value | null } | null,
  locale: string,
  {
    showWhenEqual = false,
  }: {
    /** Keeps `before → after` when both round alike. */
    readonly showWhenEqual?: boolean;
  } = {}
): string | null => {
  const after = figure ? format(figure.after, locale) : unavailableFigure;
  if (!figure || after === unavailableFigure) return null;
  const before =
    figure.before === null ? unavailableFigure : format(figure.before, locale);

  return before !== unavailableFigure && (showWhenEqual || before !== after)
    ? `${before} → ${after}`
    : after;
};

/**
 * The fewest decimals, up to two, whose last place is at most a fifth of the
 * spacing between axis ticks, so a rounded label stays close to where its
 * tick sits; every tick of an axis then shows that many.
 */
const axisDecimals = (ticks: ReadonlyArray<BigNumber>) => {
  const spacing = BigNumber.min(
    ...ticks
      .slice(1)
      .map((tick, index) => tick.minus(ticks[index] ?? tick).abs())
  );

  return (
    [0, 1].find((decimals) =>
      exactDecimal(1).shiftedBy(-decimals).lte(spacing.div(5))
    ) ?? 2
  );
};

/**
 * Value-axis labels for decimal ratios, such as "5.6% / 6.5% / 7.4%": one
 * decimal count for the whole axis, rounded half-up.
 */
export const formatPercentAxis = (
  ratios: ReadonlyArray<NumericValue>,
  locale: string
): ReadonlyArray<string> => {
  const percents = ratios.map((ratio) => exactDecimal(ratio).times(100));
  const decimals = axisDecimals(percents);

  return percents.map((percent) =>
    withPercentAffixes(formatExact(percent, locale, decimals), locale)
  );
};

const usdAxisUnits = [1e12, 1e9, 1e6, 1e3].map((unit) => exactDecimal(unit));

/**
 * Value-axis labels for USD values, such as "$0.6K / $1.2K / $1.8K": every
 * tick in the compact unit of the largest, with one decimal count for the
 * whole axis, rounded half-up.
 */
export const formatUsdAxis = (
  values: ReadonlyArray<NumericValue>,
  locale: string
): ReadonlyArray<string> => {
  const amounts = values.map((value) => exactDecimal(value));
  const largest = BigNumber.max(0, ...amounts.map((amount) => amount.abs()));
  const unit = usdAxisUnits.find((candidate) => largest.gte(candidate));
  // The language's currency and compact affixes around a sample of the unit;
  // each tick's own digits go where the sample's are.
  const sampleParts = unit
    ? getIntlFormatter("compact-usd", locale).formatToParts(unit.toNumber())
    : getIntlFormatter("usd", locale).formatToParts(1);
  const firstNumeric = sampleParts.findIndex(
    (part) => numericPartTypes[part.type]
  );
  const lastNumeric = sampleParts.findLastIndex(
    (part) => numericPartTypes[part.type]
  );
  const prefix = sampleParts
    .slice(0, firstNumeric)
    .map((part) => part.value)
    .join("");
  const suffix = sampleParts
    .slice(lastNumeric + 1)
    .map((part) => part.value)
    .join("");
  const scaled = amounts.map((amount) => (unit ? amount.div(unit) : amount));
  const decimals = axisDecimals(scaled);

  return scaled.map(
    (amount) =>
      `${amount.isNegative() ? "\u2212" : ""}${prefix}${formatExact(amount.abs(), locale, decimals)}${suffix}`
  );
};

export const toRepresentationNumber = (
  value: BigNumber | number | string
): number => exactDecimal(value).toNumber();

export const toChartNumber = toRepresentationNumber;
