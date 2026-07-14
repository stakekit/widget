import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { tokenBalancesScanAtom } from "./token-balances-atoms";

export const useTokenBalancesScan = () => {
  const { enabled, result } = useAtomValue(tokenBalancesScanAtom);
  const refresh = useAtomRefresh(tokenBalancesScanAtom);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: value === null || value === undefined ? undefined : value,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isLoading: enabled && AsyncResult.isInitial(result),
    isPending: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
