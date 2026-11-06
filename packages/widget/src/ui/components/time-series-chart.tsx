import * as stylex from "@stylexjs/stylex";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  type XAxisTickContentProps,
  YAxis,
} from "recharts";
import { Text } from "../primitives/text";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { radius } from "../tokens/radius.stylex";
import { chartHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { font, fontSize } from "../tokens/typography.stylex";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";

/** One sample: `time` in epoch milliseconds. */
export type TimeSeriesPoint = { readonly time: number; readonly value: number };

type TimeSeriesChartProps = {
  /** Names the chart, such as "Reward rate history". */
  readonly label: string;
  readonly data: ReadonlyArray<TimeSeriesPoint>;
  /** Formats a value for the value axis, such as "4.2%". */
  readonly formatValue: (value: number) => string;
  /**
   * Formats the value axis's ticks together, lowest first, so they can share
   * one precision, such as "5.6% / 6.5% / 7.4%"; unset, each tick takes
   * `formatValue`.
   */
  readonly formatValueAxis?: (
    ticks: ReadonlyArray<number>
  ) => ReadonlyArray<string>;
  /** Formats a time for the time axis, such as "Mar 4". */
  readonly formatTime: (time: number) => string;
  /** Formats the hovered value; unset, `formatValue`. */
  readonly formatTooltipValue?: (value: number) => string;
  /** Formats the hovered time; unset, `formatTime`. */
  readonly formatTooltipTime?: (time: number) => string;
  /**
   * Without points, a skeleton stands in for the chart; with points, the
   * chart dims under a spinner while new ones load.
   */
  readonly loading?: boolean;
  /** Shown when there are fewer than two points to draw. */
  readonly emptyLabel: string;
};

// Room above the top value tick and beside the edge time ticks, so their
// labels sit inside the drawing: a glyph's side bearing can reach a pixel
// past a start- or end-anchored label's tick on some platforms' fonts.
const plotMargin = { top: 8, right: 2, bottom: 0, left: 2 } as const;

/** The value axis runs a fifth past the data either way, and from 0 up. */
const valueDomain = (values: ReadonlyArray<number>) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.2, Math.abs(max) * 0.05, 0.05);
  const low = min >= 0 ? Math.max(0, min - padding) : min - padding;
  const high = max + padding;
  return [low, (low + high) / 2, high] as const;
};

/**
 * A line over a soft area for values sampled through time, such as a
 * reward-rate or TVL history, with a value axis, a time axis and a tooltip
 * for the hovered point. Axis labels stay inside the chart at every container
 * width: the value axis takes the width its labels need and the edge time
 * labels align to the edges. The chart takes no focus, by Tab or by a press:
 * its surface has no tab index, so it never draws a focus ring.
 */
export const TimeSeriesChart = ({
  label,
  data,
  formatValue,
  formatValueAxis,
  formatTime,
  formatTooltipValue = formatValue,
  formatTooltipTime = formatTime,
  loading = false,
  emptyLabel,
}: TimeSeriesChartProps) => {
  const gradientId = useId();

  if (data.length < 2) {
    // The empty message is text a screen reader must reach, so that frame is
    // a named figure; an image would hide it as a presentational child.
    if (!loading) {
      return (
        <figure
          aria-label={label}
          {...stylex.props(styles.frame, styles.empty)}
        >
          <Text tone="muted">{emptyLabel}</Text>
        </figure>
      );
    }
    return (
      <div
        role="img"
        aria-label={label}
        aria-busy
        {...stylex.props(styles.frame)}
      >
        <Skeleton shape="rect" height="fill" />
      </div>
    );
  }

  const valueTicks = valueDomain(data.map((point) => point.value));
  const valueTickLabels = formatValueAxis?.(valueTicks);
  const first = data[0]?.time ?? 0;
  const last = data.at(-1)?.time ?? first;
  const timeTicks = [first, (first + last) / 2, last];
  const tickClassName = stylex.props(styles.tick).className;

  const renderTimeTick = ({ x, y, payload }: XAxisTickContentProps) => {
    const time = Number(payload.value);
    return (
      <text
        x={x}
        y={y}
        dy="0.71em"
        textAnchor={edgeAnchor(time, first, last)}
        className={tickClassName}
      >
        {formatTime(time)}
      </text>
    );
  };

  return (
    <div
      role="img"
      aria-label={label}
      aria-busy={loading}
      {...stylex.props(styles.frame)}
    >
      <div {...stylex.props(styles.plot, loading && styles.dimmed)}>
        <AreaChart
          accessibilityLayer={false}
          data={[...data]}
          margin={plotMargin}
          responsive
          style={chartSize}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color.accent} stopOpacity={0.24} />
              <stop offset="100%" stopColor={color.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            horizontal
            stroke={color.border}
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="time"
            domain={[first, last]}
            scale="time"
            interval={0}
            tick={renderTimeTick}
            tickLine={false}
            ticks={timeTicks}
            type="number"
          />
          <YAxis
            axisLine={false}
            domain={[valueTicks[0], valueTicks[2]]}
            orientation="right"
            tick={{ className: tickClassName }}
            tickFormatter={(value: number) =>
              valueTickLabels?.[valueTicks.indexOf(value)] ?? formatValue(value)
            }
            tickLine={false}
            ticks={[...valueTicks]}
            type="number"
            width="auto"
          />
          <Tooltip
            content={({ active, payload }) => {
              const point: unknown = payload?.[0]?.payload;
              if (!active || !isPoint(point)) return null;
              return (
                <div {...stylex.props(styles.tooltip)}>
                  <Text weight="medium" numeric>
                    {formatTooltipValue(point.value)}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {formatTooltipTime(point.time)}
                  </Text>
                </div>
              );
            }}
            cursor={{ stroke: color.borderStrong, strokeDasharray: "3 3" }}
            isAnimationActive={false}
          />
          <Area
            activeDot={{ fill: color.accent, stroke: color.background }}
            dataKey="value"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            stroke={color.accent}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </div>
      {loading && (
        <span {...stylex.props(styles.spinner)}>
          <Spinner size="sm" tone="muted" />
        </span>
      )}
    </div>
  );
};

const chartSize = { height: "100%", width: "100%" } as const;

/** The first label hangs right of its tick, the last left, the rest center. */
const edgeAnchor = (time: number, first: number, last: number) => {
  if (time === first) return "start";
  if (time === last) return "end";
  return "middle";
};

const isPoint = (value: unknown): value is TimeSeriesPoint =>
  typeof value === "object" &&
  value !== null &&
  "time" in value &&
  "value" in value &&
  typeof value.time === "number" &&
  typeof value.value === "number";

const styles = stylex.create({
  frame: {
    position: "relative",
    height: chartHeight.md,
    width: "100%",
  },
  empty: {
    margin: 0,
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
  },
  plot: {
    opacity: 1,
    height: "100%",
    width: "100%",
  },
  dimmed: { opacity: 0.5 },
  spinner: {
    insetInlineEnd: space[8],
    position: "absolute",
    top: space[8],
  },
  tick: {
    fill: color.textMuted,
    fontFamily: font.sans,
    fontSize: fontSize.caption,
    fontVariantNumeric: "tabular-nums",
  },
  tooltip: {
    borderColor: color.border,
    borderRadius: radius.control,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[2],
    paddingBlock: space[8],
    paddingInline: space[12],
    backgroundColor: color.surfaceRaised,
    boxShadow: elevation.overlay,
    display: "flex",
    flexDirection: "column",
  },
});
