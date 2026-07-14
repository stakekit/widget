import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { HistoryPeriod } from "../../../domain/schema/dashboard-models";
import type { YieldId } from "../../../domain/schema/identifiers";
import {
  YieldHistoryKey,
  yieldTvlHistoryAtom,
} from "../../../hooks/api/dashboard-atoms";

export const useYieldTvlHistory = ({
  period,
  yieldId,
}: {
  period: HistoryPeriod;
  yieldId: YieldId | undefined;
}) => {
  const resource = yieldTvlHistoryAtom(
    new YieldHistoryKey({ period, yieldId: yieldId ?? null })
  );
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const page = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: [...(page?.items ?? [])].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    ),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isFetching: result.waiting,
    isLoading: !!yieldId && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
