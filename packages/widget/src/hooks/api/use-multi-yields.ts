import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Result, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { EarnYieldWithProvider } from "../../domain/schema/earn-models";
import { YieldId } from "../../domain/schema/identifiers";
import { isSupportedChain } from "../../domain/types/chains";
import { useSKWallet } from "../../providers/sk-wallet";
import { MultiYieldsKey, multiYieldsAtom } from "./yield-atoms";

export const useMultiYields = <T = EarnYieldWithProvider[]>(
  yieldIds: ReadonlyArray<string>,
  opts?: {
    select?: (val: EarnYieldWithProvider[]) => T;
    enabled?: boolean;
  }
) => {
  const { network, isConnected } = useSKWallet();
  const decodedIds = Schema.decodeUnknownResult(Schema.Array(YieldId))(
    yieldIds
  );
  const ids = Result.getOrElse(decodedIds, () => []);
  const decodeIssue = Result.isFailure(decodedIds)
    ? decodedIds.failure.message
    : null;
  const enabled = yieldIds.length > 0 && opts?.enabled !== false;
  const resource = multiYieldsAtom(
    new MultiYieldsKey({ decodeIssue, enabled, yieldIds: ids })
  );
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);
  const filtered = value?.filter((yieldModel) => {
    const visible =
      yieldModel.id !== "binance-bnb-native-staking" &&
      yieldModel.id !== "binance-testnet-bnb-native-staking" &&
      yieldModel.id !== "avax-native-staking" &&
      yieldModel.status.enter &&
      isSupportedChain(yieldModel.token.network);

    return visible && (!isConnected || network === yieldModel.token.network);
  });

  return {
    data:
      filtered === undefined
        ? undefined
        : opts?.select
          ? opts.select(filtered)
          : (filtered as T),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isLoading: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};
