import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldId } from "../../../domain/identity/identifiers";
import type {
  HistoryPeriod,
  HistoryPoint,
} from "../../../domain/portfolio/models";
import {
  YieldHistoryKey,
  yieldRewardRateHistoryAtom,
  yieldTvlHistoryAtom,
} from "../../yield-summary/index";
import {
  toRewardRateHistoryChartPoint,
  toTvlHistoryChartPoint,
} from "../model/history-chart-points";
import {
  canRenderYieldHistorySeries,
  resolveYieldHistorySeries,
  toHistoryPoints,
  type YieldHistorySeries,
} from "../model/yield-history-series";

const defaultHistoryPeriod: HistoryPeriod = "90d";

export type YieldHistoryChartView = {
  readonly canRender: boolean;
  readonly isLoading: boolean;
  readonly isRefreshing: boolean;
  readonly period: HistoryPeriod;
  readonly points: ReadonlyArray<HistoryPoint>;
};

type HistoryPage<Item> = { readonly items: ReadonlyArray<Item> } | null;

const makeHistoryChart = <Item>({
  historyAtom,
  label,
  toPoint,
}: {
  readonly historyAtom: (
    key: YieldHistoryKey
  ) => Atom.Atom<AsyncResult.AsyncResult<HistoryPage<Item>, unknown>>;
  readonly label: string;
  readonly toPoint: (item: Item) => HistoryPoint;
}) => {
  const periodAtom = Atom.make<HistoryPeriod>(defaultHistoryPeriod).pipe(
    Atom.withLabel(`${label}PeriodAtom`)
  );

  /** Retains the points already drawn, so a range switch has something to dim. */
  const seriesAtom = Atom.family((yieldId: YieldId | null) =>
    Atom.make((get): YieldHistorySeries => {
      const period = get(periodAtom);
      const result = get(historyAtom(new YieldHistoryKey({ period, yieldId })));

      return resolveYieldHistorySeries({
        hasFailed: AsyncResult.isFailure(result),
        isWaiting: result.waiting,
        points: result.pipe(
          AsyncResult.value,
          Option.map((page) => toHistoryPoints(page?.items ?? [], toPoint)),
          Option.getOrNull
        ),
        previous: Option.getOrNull(get.self<YieldHistorySeries>()),
      });
    }).pipe(Atom.withLabel(`${label}SeriesAtom`))
  );

  return {
    selectPeriodAtom: Atom.fnSync((period: HistoryPeriod, context) =>
      context.set(periodAtom, period)
    ).pipe(Atom.withLabel(`${label}SelectPeriodAtom`)),
    viewAtom: Atom.family((yieldId: YieldId | null) =>
      Atom.make((get): YieldHistoryChartView => {
        const series = get(seriesAtom(yieldId));

        return {
          canRender: canRenderYieldHistorySeries(series),
          isLoading: series.isLoading,
          isRefreshing: series.isRefreshing,
          period: get(periodAtom),
          points: series.points,
        };
      }).pipe(Atom.withLabel(`${label}ViewAtom`))
    ),
  };
};

export const earnRewardRateHistoryChart = makeHistoryChart({
  historyAtom: yieldRewardRateHistoryAtom,
  label: "earnRewardRateHistory",
  toPoint: toRewardRateHistoryChartPoint,
});

export const earnTvlHistoryChart = makeHistoryChart({
  historyAtom: yieldTvlHistoryAtom,
  label: "earnTvlHistory",
  toPoint: toTvlHistoryChartPoint,
});
