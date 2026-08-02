import { useAtomValue } from "@effect/atom-react";
import { DateTime } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { HistoryPoint } from "../../../../../domain/schema/dashboard-models";

export type YieldHistoryResult = AsyncResult.AsyncResult<
  Array<HistoryPoint>,
  unknown
>;

export const useYieldHistory = <E>(
  resource: Atom.Atom<
    AsyncResult.AsyncResult<
      { readonly items: ReadonlyArray<HistoryPoint> } | null,
      E
    >
  >
): YieldHistoryResult =>
  useAtomValue(resource).pipe(
    AsyncResult.map((page) =>
      [...(page?.items ?? [])].sort(
        (a, b) =>
          DateTime.toEpochMillis(a.timestamp) -
          DateTime.toEpochMillis(b.timestamp)
      )
    )
  );
