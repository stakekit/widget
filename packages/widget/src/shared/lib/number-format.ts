import BigNumber from "bignumber.js";

import { exactDecimal } from "../../domain/finance/exact";

/**
 * The only display formatter for numbers, and for the value ticks of a
 * chart's axes. Every function takes the Widget language explicitly. Truncation and
 * rounding happen in exact decimal arithmetic; the locale only supplies
 * separators and affixes, and Intl only renders currency and compact
 * notation after the exact work is done. Negative figures read with the minus
 * sign (U+2212), and a figure that is unknown or unavailable reads as
 * `unavailableFigure`.
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

/** From here amounts and USD values read in compact notation ("1.2M"). */
const compactFloor = exactDecimal(1_000_000);

const marketFigureDecimals = 2;
const marketFigureFloor = exactDecimal(1).shiftedBy(-marketFigureDecimals);

/**
 * Counts and market sizes, such as users, a TVL in token units or a
 * validator's stake: at most two decimals, trailing zeros dropped, grouped in
 * full below 1,000,000 ("883.29", "1,234") and compact from 1,000,000
 * ("76.12M"), rounded to nearest; a non-zero figure below 0.01 reads `<0.01`.
 * A card and a sheet showing the same figure both use this.
 */
export const formatCompactNumber = (
  value: OptionalNumericValue,
  locale: string
) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return unavailableFigure;

  if (amount.isZero()) return formatExact(amount, locale);
  if (amount.abs().lt(marketFigureFloor)) {
    return formatNumber(amount, locale, marketFigureDecimals);
  }

  const rounded = amount.decimalPlaces(
    marketFigureDecimals,
    BigNumber.ROUND_HALF_UP
  );

  if (rounded.abs().lt(compactFloor)) return formatExact(rounded, locale);

  return withMinusSign(
    getIntlFormatter("compact-token-amount-nearest", locale).format(
      amount.toNumber()
    )
  );
};

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
 * Token amounts shown as a pair, such as yearly and monthly rewards, by the
 * `formatTokenAmount` rule but at one decimal count, the most either needs
 * ("0.0834" and "0.0070"), so the pair reads alike. An amount below 0.0001,
 * from 1,000,000 or unknown (`null`) keeps its own reading.
 */
export const formatPairedTokenAmounts = (
  values: ReadonlyArray<NumericValue | null>,
  locale: string,
  rounding: TokenAmountRounding
): ReadonlyArray<string> => {
  const amounts = values.map((value) =>
    value === null ? null : exactDecimal(value)
  );
  const roundedInFull = (amount: BigNumber) => {
    if (amount.isZero() || amount.abs().lt(tokenAmountFloor)) return null;
    const rounded = amount.decimalPlaces(
      tokenAmountDecimals,
      tokenAmountRoundingModes[rounding]
    );
    return rounded.abs().lt(compactFloor) ? rounded : null;
  };
  const decimals = Math.max(
    0,
    ...amounts.map((amount) =>
      amount === null ? 0 : (roundedInFull(amount)?.decimalPlaces() ?? 0)
    )
  );

  return amounts.map((amount) => {
    if (amount === null) return unavailableFigure;
    const rounded = roundedInFull(amount);
    return rounded
      ? formatExact(rounded, locale, decimals)
      : formatTokenAmount(amount, locale, rounding);
  });
};

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

/** Reward rates and commissions always read with this many decimals. */
const percentDecimals = 2;

/** The percent of a decimal ratio, rounded half-up to two places. */
const roundedPercent = (value: NumericValue) =>
  exactDecimal(value).times(100).decimalPlaces(percentDecimals);

/**
 * Formats a decimal ratio as a percent rounded half-up to two places and
 * always shown with both ("1.60%"), used for reward rates, commissions and
 * fees, so rates side by side line up. Zero reads `0%`; a non-zero ratio that
 * rounds to zero reads `<0.01%` (`>−0.01%` when negative), so no rate that
 * exists reads as 0%.
 */
export const formatRoundedPercent = (value: NumericValue, locale: string) => {
  const exact = exactDecimal(value);
  const rounded = roundedPercent(exact);

  if (exact.isZero()) {
    return withPercentAffixes(formatExact(exact, locale), locale);
  }

  if (rounded.isZero()) {
    return exact.isNegative()
      ? `>${withPercentAffixes(formatExact(exactDecimal("-0.01"), locale), locale)}`
      : `<${withPercentAffixes(formatExact(exactDecimal("0.01"), locale), locale)}`;
  }

  return withPercentAffixes(
    formatExact(rounded, locale, percentDecimals),
    locale
  );
};

/**
 * `formatRoundedPercent` split as `AnimatedNumber`'s props for a rate that
 * counts to its value: the percent affixes stay apart, and `format` keeps
 * every step to two places, so the digits change count only when the integer
 * part does and the last step reads exactly as the rate.
 */
export const getRoundedPercentParts = (locale: string) => {
  const { percentPrefix, percentSuffix } = getLocaleNumberSymbols(locale);

  return {
    prefix: percentPrefix,
    suffix: percentSuffix,
    format: (value: number) =>
      formatExact(roundedPercent(value), locale, percentDecimals),
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

/** The round steps an axis takes between ticks, per power of ten. */
const niceStepMantissas = ["1", "2", "2.5", "5"].map((mantissa) =>
  exactDecimal(mantissa)
);
const maximumAxisIntervals = 4;
/** A flat series is spanned this fraction of its value either way. */
const flatSeriesSpan = exactDecimal("0.05");

const axisExtent = (low: BigNumber, high: BigNumber) => {
  if (!low.eq(high)) return [low, high] as const;
  if (low.isZero()) return [low, exactDecimal(1)] as const;
  const span = low.abs().times(flatSeriesSpan);
  return [low.minus(span), high.plus(span)] as const;
};

/**
 * Value-axis ticks that span `values` in a round step, 1, 2, 2.5 or 5 × 10ⁿ:
 * the finest step that needs at most four intervals, so an axis takes four or
 * five ticks. Ticks are exact multiples of the step, so each reads in few
 * digits, and an axis over values that are never negative never goes below
 * zero. A flat series is spanned 5% either way (0 to 1 at zero).
 */
export const getValueAxisTicks = (
  values: ReadonlyArray<number>
): ReadonlyArray<number> => {
  if (values.length === 0) return [];

  const [low, high] = axisExtent(
    exactDecimal(Math.min(...values)),
    exactDecimal(Math.max(...values))
  );
  const intervalsOf = (step: BigNumber) => ({
    first: low.div(step).integerValue(BigNumber.ROUND_FLOOR),
    last: high.div(step).integerValue(BigNumber.ROUND_CEIL),
  });
  // Float logarithms can land a decade low; the steps of three decades from
  // there still hold the finest one that fits.
  const magnitude = exactDecimal(10).pow(
    Math.floor(Math.log10(high.minus(low).div(maximumAxisIntervals).toNumber()))
  );
  const steps = [1, 10, 100].flatMap((decade) =>
    niceStepMantissas.map((mantissa) => mantissa.times(magnitude).times(decade))
  );
  const step =
    steps.find((candidate) => {
      const { first, last } = intervalsOf(candidate);
      return last.minus(first).lte(maximumAxisIntervals);
    }) ?? magnitude.times(1000);
  const { first, last } = intervalsOf(step);

  return Array.from({ length: last.minus(first).toNumber() + 1 }, (_, index) =>
    first.plus(index).times(step).toNumber()
  );
};

/** Axis labels never show more decimals than this. */
const maximumAxisDecimals = 4;

/**
 * The fewest decimals that write every tick exactly, up to four; every tick
 * of an axis then shows that many. Round ticks from `getValueAxisTicks` need
 * few.
 */
const axisDecimals = (ticks: ReadonlyArray<BigNumber>) =>
  Math.max(
    0,
    ...ticks.map(
      (tick) => tick.decimalPlaces(maximumAxisDecimals).decimalPlaces() ?? 0
    )
  );

/**
 * Value-axis labels for decimal ratios, such as "5.5% / 6.0% / 6.5%": one
 * decimal count for the whole axis; zero reads `0%`.
 */
export const formatPercentAxis = (
  ratios: ReadonlyArray<NumericValue>,
  locale: string
): ReadonlyArray<string> => {
  const percents = ratios.map((ratio) => exactDecimal(ratio).times(100));
  const decimals = axisDecimals(percents);

  return percents.map((percent) =>
    withPercentAffixes(
      formatExact(percent, locale, percent.isZero() ? 0 : decimals),
      locale
    )
  );
};

/** From here an axis tick reads compact; below it, in full ("$600"). */
const compactAxisFloor = exactDecimal(1000);
const compactAxisUnits = [1e12, 1e9, 1e6, 1e3].map((unit) =>
  exactDecimal(unit)
);

type AxisAffixes = { readonly prefix: string; readonly suffix: string };

/**
 * The language's currency and compact affixes around a sample figure; each
 * tick's own digits go where the sample's are.
 */
const affixesAround = (parts: ReadonlyArray<Intl.NumberFormatPart>) => {
  const firstNumeric = parts.findIndex((part) => numericPartTypes[part.type]);
  const lastNumeric = parts.findLastIndex(
    (part) => numericPartTypes[part.type]
  );
  const join = (from: number, to?: number) =>
    parts
      .slice(from, to)
      .map((part) => part.value)
      .join("");

  return { prefix: join(0, firstNumeric), suffix: join(lastNumeric + 1) };
};

/**
 * Value-axis labels for amounts: ticks from 1,000 in the compact unit of the
 * largest tick, the rest in full, with one decimal count for each and zero
 * as a bare 0. USD in full shows whole dollars or cents.
 */
const formatAmountTicks = (
  values: ReadonlyArray<NumericValue>,
  locale: string,
  currency: "usd" | null
): ReadonlyArray<string> => {
  const amounts = values.map((value) => exactDecimal(value));
  const largest = BigNumber.max(0, ...amounts.map((amount) => amount.abs()));
  const unit = compactAxisUnits.find((candidate) => largest.gte(candidate));
  const plainAffixes: AxisAffixes =
    currency === "usd"
      ? affixesAround(getIntlFormatter("usd", locale).formatToParts(1))
      : { prefix: "", suffix: "" };
  const compactAffixes: AxisAffixes = unit
    ? affixesAround(
        getIntlFormatter(
          currency === "usd" ? "compact-usd" : "compact-token-amount-nearest",
          locale
        ).formatToParts(unit.toNumber())
      )
    : plainAffixes;
  const isCompact = (amount: BigNumber) =>
    unit !== undefined && amount.abs().gte(compactAxisFloor);
  const compactDecimals = axisDecimals(
    amounts.filter(isCompact).map((amount) => amount.div(unit ?? 1))
  );
  const plainExactDecimals = axisDecimals(
    amounts.filter((amount) => !isCompact(amount))
  );
  const plainDecimals =
    currency === "usd" && plainExactDecimals > 0
      ? Math.max(2, plainExactDecimals)
      : plainExactDecimals;

  return amounts.map((amount) => {
    const sign = amount.isNegative() ? "\u2212" : "";
    if (amount.isZero()) {
      return `${plainAffixes.prefix}${formatExact(amount, locale, 0)}${plainAffixes.suffix}`;
    }
    if (isCompact(amount)) {
      const digits = formatExact(
        amount.abs().div(unit ?? 1),
        locale,
        compactDecimals
      );
      return `${sign}${compactAffixes.prefix}${digits}${compactAffixes.suffix}`;
    }
    const digits = formatExact(amount.abs(), locale, plainDecimals);
    return `${sign}${plainAffixes.prefix}${digits}${plainAffixes.suffix}`;
  });
};

/**
 * Value-axis labels for USD values, such as "$500 / $1.0K / $1.5K": ticks
 * from 1,000 in the largest tick's compact unit, ticks under 1,000 in full,
 * zero as `$0`, one decimal count for the compact ticks.
 */
export const formatUsdAxis = (
  values: ReadonlyArray<NumericValue>,
  locale: string
): ReadonlyArray<string> => formatAmountTicks(values, locale, "usd");

/**
 * Value-axis labels for token amounts, such as "500 / 1.0K / 1.5K": the
 * `formatUsdAxis` rule without the currency.
 */
export const formatAmountAxis = (
  values: ReadonlyArray<NumericValue>,
  locale: string
): ReadonlyArray<string> => formatAmountTicks(values, locale, null);

const ratioSignificantDigits = { fewest: 4, most: 6 } as const;

/**
 * Ratios such as a price per share or an exchange rate, to six significant
 * digits and never fewer than four ("1.06275", "1.500", "0.000123457"),
 * rounded half-up; the integer part is never rounded ("12,345.7").
 */
export const formatRatio = (value: OptionalNumericValue, locale: string) => {
  const amount = toFiniteDecimal(value);
  if (!amount) return unavailableFigure;
  if (amount.isZero()) return formatExact(amount, locale);

  const exponent = amount.abs().e ?? 0;
  const decimalsFor = (digits: number) => Math.max(0, digits - 1 - exponent);
  const rounded = amount.decimalPlaces(
    decimalsFor(ratioSignificantDigits.most),
    BigNumber.ROUND_HALF_UP
  );

  return formatExact(
    rounded,
    locale,
    Math.max(
      decimalsFor(ratioSignificantDigits.fewest),
      rounded.decimalPlaces() ?? 0
    )
  );
};

export const toRepresentationNumber = (
  value: BigNumber | number | string
): number => exactDecimal(value).toNumber();

export const toChartNumber = toRepresentationNumber;
