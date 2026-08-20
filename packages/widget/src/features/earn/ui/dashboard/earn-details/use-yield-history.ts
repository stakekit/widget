import { useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { HistoryPoint } from "../../../../../domain/portfolio/models";

export type YieldHistoryResult = AsyncResult.AsyncResult<
  Array<HistoryPoint>,
  unknown
>;

export const useYieldHistory = <Item, E>(
  resource: Atom.Atom<
    AsyncResult.AsyncResult<{ readonly items: ReadonlyArray<Item> } | null, E>
  >,
  toChartPoint: (item: Item) => HistoryPoint
): YieldHistoryResult =>
  useAtomValue(resource).pipe(
    AsyncResult.map((page) =>
      [...(page?.items ?? []).map(toChartPoint)].sort(
        (a, b) =>
          DateTime.toEpochMillis(a.timestamp) -
          DateTime.toEpochMillis(b.timestamp)
      )
    )
  );
