import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { YieldId } from "../../../domain/schema/identifiers";
import { YieldOpportunityKey, yieldOpportunityAtom } from "../yield-atoms";

export const useYieldOpportunity = (integrationId: string | undefined) => {
  const decodedId = integrationId
    ? Schema.decodeUnknownResult(YieldId)(integrationId)
    : null;
  const yieldId = decodedId ? Result.getOrElse(decodedId, () => null) : null;
  const decodeIssue =
    decodedId && Result.isFailure(decodedId) ? decodedId.failure.message : null;
  const resource = yieldOpportunityAtom(
    new YieldOpportunityKey({ decodeIssue, yieldId })
  );
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: value === null ? undefined : value,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: !!integrationId && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
