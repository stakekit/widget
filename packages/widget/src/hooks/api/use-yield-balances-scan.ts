import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect } from "react";
import type { EarnPosition } from "../../domain/schema/earn-models";
import { YieldBalancesCommand as YieldBalancesCommandSchema } from "../../domain/schema/financial-models";
import { useSKWallet } from "../../providers/sk-wallet";
import { useActionHistoryData } from "../../providers/stake-history";
import { YieldBalancesKey, yieldBalancesAtom } from "./yield-balances-atoms";

const useYieldBalancesResource = () => {
  const { network, address } = useSKWallet();
  const command =
    address && network
      ? Schema.decodeUnknownSync(YieldBalancesCommandSchema)({
          queries: [{ address, network }],
        })
      : null;
  const enabled = !!command;
  const resource = yieldBalancesAtom(
    new YieldBalancesKey({ command, enabled })
  );

  return { enabled, resource };
};

export const useYieldBalancesScan = <T = ReadonlyArray<EarnPosition>>(opts?: {
  select?: (data: ReadonlyArray<EarnPosition>) => T;
}) => {
  const { enabled, resource } = useYieldBalancesResource();
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const page = result.pipe(AsyncResult.value, Option.getOrUndefined);
  const value = page?.items;
  const actionHistoryData = useActionHistoryData();
  const lastActionTimestamp = actionHistoryData
    .map((item) => item.timestamp)
    .extractNullable();

  useEffect(() => {
    if (!enabled) return;
    const interval = globalThis.setInterval(refresh, 60_000);
    return () => globalThis.clearInterval(interval);
  }, [enabled, refresh]);

  useEffect(() => {
    if (!lastActionTimestamp) return;
    const refreshIfRecent = () => {
      if (Date.now() - lastActionTimestamp < 12_000) refresh();
    };
    const interval = globalThis.setInterval(refreshIfRecent, 4_000);
    return () => globalThis.clearInterval(interval);
  }, [lastActionTimestamp, refresh]);

  return {
    data:
      value === undefined
        ? undefined
        : opts?.select
          ? opts.select(value)
          : (value as T),
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isFetching: result.waiting,
    isLoading: enabled && AsyncResult.isInitial(result),
    isPending: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};

export const useInvalidateYieldBalances = () => {
  const { resource } = useYieldBalancesResource();
  return useAtomRefresh(resource);
};
