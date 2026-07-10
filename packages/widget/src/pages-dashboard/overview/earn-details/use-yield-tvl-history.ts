import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { YieldId } from "../../../domain/schema/identifiers";
import {
  YieldHistoryKey,
  yieldTvlHistoryAtom,
} from "../../../hooks/api/dashboard-atoms";
import type { RewardRateHistoryPeriod } from "./use-yield-reward-rate-history";

export const useYieldTvlHistory = ({
  period,
  yieldId: rawYieldId,
}: {
  period: RewardRateHistoryPeriod;
  yieldId: string | undefined;
}) => {
  const yieldId = rawYieldId
    ? Schema.decodeUnknownSync(YieldId)(rawYieldId)
    : null;
  const resource = yieldTvlHistoryAtom(
    new YieldHistoryKey({ period, yieldId })
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
