import * as stylex from "@stylexjs/stylex";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
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
import { font, fontSize, fontWeight } from "../tokens/typography.stylex";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";

/** One sample: `time` in epoch milliseconds. */
export type TimeSeriesPoint = { readonly time: number; readonly value: number };

/** An axis's ticks and their labels, one each. */
export type TimeSeriesAxis = {
  /** Lowest or earliest first; the axis spans the first to the last. */
  readonly ticks: ReadonlyArray<number>;
  readonly labels: ReadonlyArray<string>;
};

type TimeSeriesChartProps = {
  /** Names the chart, such as "Reward rate history". */
  readonly label: string;
  readonly data: ReadonlyArray<TimeSeriesPoint>;
  /**
   * The value axis, such as "1.5% / 1.6% / 1.7%": round ticks the Feature
   * labels together, in one precision.
   */
  readonly valueAxis: TimeSeriesAxis;
  /**
   * The time axis: it spans the selected range even where the data starts
   * late or stops early, such as "Aug 8 / Sep 22 / Nov 6".
   */
  readonly timeAxis: TimeSeriesAxis;
  /** Formats the hovered value, such as "1.62%". */
  readonly formatTooltipValue: (value: number) => string;
  /** Formats the hovered time, such as "Sep 22, 2026". */
  readonly formatTooltipTime: (time: number) => string;
  /** Labels the latest point beside its dot, such as "883.29 ETH". */
  readonly latestLabel?: string;
  /**
   * A note under the plot, such as "Data to Sep 16" when the data stops
   * before the time axis ends.
   */
  readonly caption?: string;
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

// The tooltip sits above and right of the cursor, clear of the line under
// it, and flips below or left only where the plot ends.
const tooltipOffset = { x: 12, y: 16 } as const;
const tooltipAbove = { x: false, y: true } as const;

/** The latest point's dot and the gap between it and its label. */
const latestDotRadius = 4;
const latestLabelGap = 8;
/** A label within this fraction of the plot's top or bottom edge flips. */
const latestLabelEdge = 0.2;

/**
 * Strokes: the dashes of the grid and the hover cursor; the line's width,
 * which the latest dot's ring repeats; and the background halo that keeps
 * the latest label legible over the line.
 */
const chartStroke = { dash: "3 3", line: 2, labelHalo: 4 } as const;

/**
 * A line over a soft area for values sampled through time, such as a
 * reward-rate or TVL history, with round value ticks, a time axis over the
 * whole selected range, the latest point marked and labelled, and a tooltip
 * for the hovered point. Axis labels stay inside the chart at every container
 * width: the value axis takes the width its labels need and the edge time
 * labels align to the edges. The chart takes no focus, by Tab or by a press:
 * its surface has no tab index, so it never draws a focus ring. Its height
 * never changes, with or without a caption, so switching ranges never moves
 * what follows it.
 */
export const TimeSeriesChart = ({
  label,
  data,
  valueAxis,
  timeAxis,
  formatTooltipValue,
  formatTooltipTime,
  latestLabel,
  caption,
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

  const valueLow = valueAxis.ticks[0] ?? "dataMin";
  const valueHigh = valueAxis.ticks.at(-1) ?? "dataMax";
  const first = timeAxis.ticks[0] ?? data[0]?.time ?? 0;
  const last = timeAxis.ticks.at(-1) ?? data.at(-1)?.time ?? first;
  const latest = data.at(-1);
  const tickClassName = stylex.props(styles.tick).className;
  const latestLabelClassName = stylex.props(styles.latestLabel).className;

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
        {timeAxis.labels[timeAxis.ticks.indexOf(time)] ?? ""}
      </text>
    );
  };

  const latestLabelBelow = latest
    ? isLabelBelow({
        latest: latest.value,
        previous: data.at(-2)?.value ?? latest.value,
        low: typeof valueLow === "number" ? valueLow : latest.value,
        high: typeof valueHigh === "number" ? valueHigh : latest.value,
      })
    : false;

  return (
    <div
      role="img"
      aria-label={label}
      aria-busy={loading}
      {...stylex.props(styles.frame, styles.stack)}
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
            strokeDasharray={chartStroke.dash}
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
            ticks={[...timeAxis.ticks]}
            type="number"
          />
          <YAxis
            axisLine={false}
            domain={[valueLow, valueHigh]}
            orientation="right"
            tick={{ className: tickClassName }}
            tickFormatter={(value: number) =>
              valueAxis.labels[valueAxis.ticks.indexOf(value)] ?? ""
            }
            tickLine={false}
            ticks={[...valueAxis.ticks]}
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
            cursor={{
              stroke: color.borderStrong,
              strokeDasharray: chartStroke.dash,
            }}
            isAnimationActive={false}
            offset={tooltipOffset}
            reverseDirection={tooltipAbove}
          />
          <Area
            activeDot={{ fill: color.accent, stroke: color.background }}
            dataKey="value"
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            stroke={color.accent}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={chartStroke.line}
            type="monotone"
          />
          {latest && (
            <ReferenceDot
              ifOverflow="visible"
              x={latest.time}
              y={latest.value}
              shape={({ cx = 0, cy = 0 }) => (
                <g>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={latestDotRadius}
                    fill={color.accent}
                    stroke={color.background}
                    strokeWidth={chartStroke.line}
                  />
                  {latestLabel !== undefined && (
                    <text
                      x={cx - latestLabelGap}
                      y={
                        latestLabelBelow
                          ? cy + latestLabelGap
                          : cy - latestLabelGap
                      }
                      dominantBaseline={
                        latestLabelBelow ? "hanging" : "alphabetic"
                      }
                      textAnchor="end"
                      paintOrder="stroke"
                      stroke={color.background}
                      strokeWidth={chartStroke.labelHalo}
                      strokeLinejoin="round"
                      className={latestLabelClassName}
                    >
                      {latestLabel}
                    </text>
                  )}
                </g>
              )}
            />
          )}
        </AreaChart>
      </div>
      {caption !== undefined && (
        <span {...stylex.props(styles.caption)}>
          <Text variant="caption" tone="muted">
            {caption}
          </Text>
        </span>
      )}
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

/**
 * The latest point's label goes where the line is not: below the dot when
 * the line falls into it, above when it rises, and away from the plot's top
 * or bottom edge when the dot sits near one.
 */
const isLabelBelow = ({
  latest,
  previous,
  low,
  high,
}: {
  readonly latest: number;
  readonly previous: number;
  readonly low: number;
  readonly high: number;
}) => {
  const height = high - low;
  const position = height > 0 ? (latest - low) / height : 0.5;
  if (position > 1 - latestLabelEdge) return true;
  if (position < latestLabelEdge) return false;
  return previous > latest;
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
  stack: {
    gap: space[4],
    display: "flex",
    flexDirection: "column",
  },
  empty: {
    margin: 0,
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
  },
  plot: {
    flexGrow: 1,
    opacity: 1,
    minHeight: 0,
    width: "100%",
  },
  dimmed: { opacity: 0.5 },
  caption: {
    display: "flex",
    justifyContent: "flex-end",
  },
  spinner: {
    insetInlineEnd: space[8],
    position: "absolute",
    top: space[8],
  },
  tick: {
    fill: color.textMuted,
    fontFamily: font.figure,
    fontSize: fontSize.caption,
    fontVariantNumeric: "tabular-nums",
  },
  latestLabel: {
    fill: color.text,
    fontFamily: font.figure,
    fontSize: fontSize.caption,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.medium,
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
