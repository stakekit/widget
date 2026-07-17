import { useAtom } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { tokenBalancesScanAtom } from "../resources/token-balances";

export const useTokenBalancesScan = () => {
  const [{ enabled, result }, refresh] = useAtom(tokenBalancesScanAtom);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  return {
    data: value === null || value === undefined ? undefined : value,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isLoading: enabled && AsyncResult.isInitial(result),
    isPending: enabled && AsyncResult.isInitial(result),
    refetch: () => refresh(undefined),
  } as const;
};
