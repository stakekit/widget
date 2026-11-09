import { DateTime, Duration } from "effect";
import type { TFunction } from "i18next";
import { exactDecimal } from "../../../domain/finance/exact";
import type {
  HistoryPeriod,
  HistoryPoint,
} from "../../../domain/portfolio/models";
import { formatDateTime, formatTimeAxis } from "../../../shared/lib/date";
import {
  formatAmountAxis,
  formatPercentAxis,
  formatRoundedPercent,
  getValueAxisTicks,
} from "../../../shared/lib/number-format";
import {
  formatTvlAmount,
  type YieldRateFigure,
  type YieldTvlFigure,
} from "../../yield-summary/index";

// History is sampled per day, week, or month at UTC midnight; formatting in
// any other zone would show the neighbouring calendar day.
const historyTimeZone = DateTime.zoneMakeNamedUnsafe("UTC");

/** How far back each period reaches from now; `all` from the first point. */
const periodSpans = {
  "30d": Duration.days(30),
  "90d": Duration.days(90),
  "1y": Duration.days(365),
  all: null,
} satisfies Record<HistoryPeriod, Duration.Duration | null>;

/**
 * A series whose latest point is older than this has stopped early: longer
 * than one missed sample at the period's sampling (daily up to 90 days,
 * weekly beyond).
 */
const stalePeriods = {
  "30d": Duration.days(2),
  "90d": Duration.days(2),
  "1y": Duration.days(14),
  all: Duration.days(14),
} satisfies Record<HistoryPeriod, Duration.Duration>;

type HistoryChartAxis = {
  /** Lowest or earliest first; the axis spans the first to the last. */
  readonly ticks: ReadonlyArray<number>;
  /** One label per tick. */
  readonly labels: ReadonlyArray<string>;
};

/** A history chart ready to draw: its header, its series and its axes. */
export type HistoryChart = {
  readonly title: string;
  /** The figure beside the title, such as the latest rate "1.70%". */
  readonly figure: string | null;
  /** A line under the title, such as the TVL in token units. */
  readonly secondary: string | null;
  /** The points, `time` in epoch milliseconds, earliest first. */
  readonly data: ReadonlyArray<{
    readonly time: number;
    readonly value: number;
  }>;
  readonly valueAxis: HistoryChartAxis;
  /** Spans the selected period up to now, even where the data stops short. */
  readonly timeAxis: HistoryChartAxis;
  /** The latest point's value, labelled at its dot. */
  readonly latestLabel: string | null;
  /** Says the series ends before the period does, such as "Data to Sep 16". */
  readonly caption: string | null;
  /** Formats a hovered value. */
  readonly formatValue: (value: number) => string;
  /** Formats a hovered time. */
  readonly formatTime: (time: number) => string;
};

type HistoryChartInput = {
  readonly locale: string;
  /** The presentation clock's now; null until it reads. */
  readonly now: DateTime.Utc | null;
  readonly period: HistoryPeriod;
  readonly points: ReadonlyArray<HistoryPoint>;
  readonly t: TFunction;
};

const formatHistoryDate = (
  time: number,
  locale: string,
  options: Pick<Intl.DateTimeFormatOptions, "year">
) =>
  formatDateTime(DateTime.makeUnsafe(time), {
    timeZone: historyTimeZone,
    locale,
    month: "short",
    day: "numeric",
    ...options,
  });

const getHistoryChart = (
  { locale, now, period, points, t }: HistoryChartInput,
  {
    figure,
    formatValue,
    formatValueAxis,
    secondary,
    title,
  }: {
    readonly figure: string | null;
    readonly formatValue: (value: number) => string;
    readonly formatValueAxis: (
      ticks: ReadonlyArray<number>
    ) => ReadonlyArray<string>;
    readonly secondary: string | null;
    readonly title: string;
  }
): HistoryChart => {
  const series = points.map((point) => ({
    time: DateTime.toEpochMillis(point.timestamp),
    value: point.value,
  }));
  const seriesLatest = series.at(-1);
  const span = periodSpans[period];
  const end = Math.max(
    now ? DateTime.toEpochMillis(now) : 0,
    seriesLatest?.time ?? 0
  );
  // A bounded period starts exactly its span before the end, and points older
  // than that fall outside it; `all` starts at the first point.
  const start = span ? end - Duration.toMillis(span) : (series[0]?.time ?? end);
  const data = series.filter((point) => point.time >= start);
  const latest = data.at(-1);
  const valueTicks = getValueAxisTicks(data.map((point) => point.value));
  const timeTicks = latest ? [start, (start + end) / 2, end] : [];
  const endsEarly =
    seriesLatest !== undefined &&
    end - seriesLatest.time > Duration.toMillis(stalePeriods[period]);

  return {
    title,
    figure,
    secondary,
    data,
    valueAxis: { ticks: valueTicks, labels: formatValueAxis(valueTicks) },
    timeAxis: {
      ticks: timeTicks,
      labels: formatTimeAxis(timeTicks, { locale, timeZone: historyTimeZone }),
    },
    latestLabel: latest ? formatValue(latest.value) : null,
    caption: endsEarly
      ? t("dashboard.earn_details.chart_data_to", {
          date: formatHistoryDate(seriesLatest.time, locale, {}),
        })
      : null,
    formatValue,
    formatTime: (time) => formatHistoryDate(time, locale, { year: "numeric" }),
  };
};

/**
 * The reward-rate history: points in percent, titled with the yield's rate
 * type ("APY", "APR") and the latest point. Before any point loads the figure
 * shows the yield's rate; without a rate the title reads "Reward rate".
 */
export const getRewardRateHistoryChart = ({
  rate,
  ...input
}: HistoryChartInput & { readonly rate: YieldRateFigure | null }) => {
  const { locale, points, t } = input;
  const formatValue = (value: number) =>
    formatRoundedPercent(exactDecimal(value).div(100), locale);
  const latest = points.at(-1);

  return getHistoryChart(input, {
    figure: latest ? formatValue(latest.value) : (rate?.value ?? null),
    formatValue,
    formatValueAxis: (ticks) =>
      formatPercentAxis(
        ticks.map((tick) => exactDecimal(tick).div(100)),
        locale
      ),
    secondary: null,
    title: rate?.label ?? t("dashboard.earn_details.reward_rate"),
  });
};

/**
 * The TVL history: points in the yield's token units, on a token axis,
 * titled with the USD TVL and the token amount beneath it. The latest point
 * reads through the same formatter as that token amount.
 */
export const getTvlHistoryChart = ({
  symbol,
  tvl,
  ...input
}: HistoryChartInput & {
  /** The token the history counts in, the yield's own. */
  readonly symbol: string;
  readonly tvl: YieldTvlFigure | null;
}) => {
  const { locale, points, t } = input;
  const formatValue = (value: number) => formatTvlAmount(value, symbol, locale);
  const latest = points.at(-1);

  return getHistoryChart(input, {
    figure: tvl?.usd ?? (latest ? formatValue(latest.value) : null),
    formatValue,
    formatValueAxis: (ticks) => formatAmountAxis(ticks, locale),
    secondary: tvl?.token ?? null,
    title: t("dashboard.earn_details.tvl"),
  });
};
