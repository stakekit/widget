import * as stylex from "@stylexjs/stylex";
import { lazy, Suspense } from "react";

import { Text } from "../primitives/text";
import { chartHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";
import type { TimeSeriesPlotProps } from "./time-series-plot";

type TimeSeriesChartProps = TimeSeriesPlotProps & {
  /** Names the chart, such as "Reward rate history". */
  readonly label: string;
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

// Recharts and d3 load with the first chart that has points to draw, so a
// host that never shows one never downloads them.
const TimeSeriesPlot = lazy(() =>
  import("./time-series-plot").then(({ TimeSeriesPlot }) => ({
    default: TimeSeriesPlot,
  }))
);

/**
 * A line over a soft area for values sampled through time, such as a
 * reward-rate or TVL history, with round value ticks, a time axis over the
 * whole selected range, the latest point marked and labelled, and a tooltip
 * for the hovered point. Axis labels stay inside the chart at every container
 * width: the value axis takes the width its labels need and the edge time
 * labels align to the edges. The chart takes no focus, by Tab or by a press:
 * its surface has no tab index, so it never draws a focus ring. Its height
 * never changes, with or without a caption, so switching ranges never moves
 * what follows it. Until its drawing code loads, a skeleton holds the plot's
 * place.
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

  return (
    <div
      role="img"
      aria-label={label}
      aria-busy={loading}
      {...stylex.props(styles.frame, styles.stack)}
    >
      <div {...stylex.props(styles.plot, loading && styles.dimmed)}>
        <Suspense fallback={<Skeleton shape="rect" height="fill" />}>
          <TimeSeriesPlot
            data={data}
            valueAxis={valueAxis}
            timeAxis={timeAxis}
            formatTooltipValue={formatTooltipValue}
            formatTooltipTime={formatTooltipTime}
            latestLabel={latestLabel}
          />
        </Suspense>
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
});
