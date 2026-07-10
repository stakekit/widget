import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type {
  HistoryPeriod,
  HistoryPoint,
} from "../../../domain/schema/dashboard-models";
import { YieldId } from "../../../domain/schema/identifiers";
import {
  YieldHistoryKey,
  yieldRewardRateHistoryAtom,
} from "../../../hooks/api/dashboard-atoms";

export type RewardRateHistoryPeriod = HistoryPeriod;
export type RewardRateHistoryPoint = HistoryPoint;

export const useYieldRewardRateHistory = ({
  period,
  yieldId: rawYieldId,
}: {
  period: RewardRateHistoryPeriod;
  yieldId: string | undefined;
}) => {
  const yieldId = rawYieldId
    ? Schema.decodeUnknownSync(YieldId)(rawYieldId)
    : null;
  const resource = yieldRewardRateHistoryAtom(
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
