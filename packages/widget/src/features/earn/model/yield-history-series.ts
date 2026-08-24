import { DateTime } from "effect";
import type { HistoryPoint } from "../../../domain/portfolio/models";

const minimumRenderablePoints = 2;

export type YieldHistorySeries = {
  readonly hasDisplayedPoints: boolean;
  readonly hasFailed: boolean;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly points: ReadonlyArray<HistoryPoint>;
};

export const toHistoryPoints = <Item>(
  items: ReadonlyArray<Item>,
  toPoint: (item: Item) => HistoryPoint
): ReadonlyArray<HistoryPoint> =>
  items
    .map(toPoint)
    .sort(
      (left, right) =>
        DateTime.toEpochMillis(left.timestamp) -
        DateTime.toEpochMillis(right.timestamp)
    );

const isRenderable = (points: ReadonlyArray<HistoryPoint>) =>
  points.length >= minimumRenderablePoints;

/**
 * Keeps the previously displayed points on screen while another period loads,
 * so a range switch dims the existing chart instead of replacing it with a
 * skeleton.
 */
export const resolveYieldHistorySeries = ({
  hasFailed,
  isWaiting,
  points,
  previous,
}: {
  readonly hasFailed: boolean;
  readonly isWaiting: boolean;
  readonly points: ReadonlyArray<HistoryPoint> | null;
  readonly previous: YieldHistorySeries | null;
}): YieldHistorySeries => {
  const hadPoints = previous?.hasDisplayedPoints === true;

  if (points) {
    return {
      hasDisplayedPoints: hadPoints || isRenderable(points),
      hasFailed: false,
      isLoading: false,
      isRefreshing: isWaiting,
      points,
    };
  }

  if (hasFailed) {
    return {
      hasDisplayedPoints: hadPoints,
      hasFailed: true,
      isLoading: false,
      isRefreshing: false,
      points: [],
    };
  }

  const retained =
    previous && isRenderable(previous.points) ? previous.points : null;

  return retained
    ? {
        hasDisplayedPoints: true,
        hasFailed: false,
        isLoading: false,
        isRefreshing: true,
        points: retained,
      }
    : {
        hasDisplayedPoints: hadPoints,
        hasFailed: false,
        isLoading: true,
        isRefreshing: false,
        points: [],
      };
};

/**
 * Once a range has rendered, keep the section (and its range buttons) mounted
 * even when another range has too few points to draw.
 */
export const canRenderYieldHistorySeries = (series: YieldHistorySeries) =>
  !series.hasFailed &&
  (series.isLoading ||
    series.hasDisplayedPoints ||
    isRenderable(series.points));
