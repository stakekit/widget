import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { useEffect } from "react";
import { TokenBalanceScanCommand as TokenBalanceScanCommandSchema } from "../../domain/schema/financial-models";
import { useSKWallet } from "../../providers/sk-wallet";
import { TokenBalancesKey, tokenBalancesAtom } from "./token-balances-atoms";

const useTokenBalancesResource = () => {
  const {
    additionalAddresses,
    address,
    network,
    isLedgerLiveAccountPlaceholder,
  } = useSKWallet();
  const command =
    address && network
      ? Schema.decodeUnknownSync(TokenBalanceScanCommandSchema)({
          addresses: {
            address,
            ...(additionalAddresses ? { additionalAddresses } : {}),
          },
          network,
        })
      : null;
  const enabled = !!command && !isLedgerLiveAccountPlaceholder;
  const resource = tokenBalancesAtom(
    new TokenBalancesKey({ command, enabled })
  );

  return { enabled, resource };
};

export const useTokenBalancesScan = () => {
  const { enabled, resource } = useTokenBalancesResource();
  const result = useAtomValue(resource);
  const refresh = useAtomRefresh(resource);
  const value = result.pipe(AsyncResult.value, Option.getOrUndefined);

  useEffect(() => {
    if (!enabled) return;
    const interval = globalThis.setInterval(refresh, 60_000);
    return () => globalThis.clearInterval(interval);
  }, [enabled, refresh]);

  return {
    data: value === null || value === undefined ? undefined : value,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    isError: AsyncResult.isFailure(result),
    isLoading: enabled && AsyncResult.isInitial(result),
    isPending: enabled && AsyncResult.isInitial(result),
    refetch: refresh,
  } as const;
};

export const useInvalidateTokenBalances = () => {
  const { resource } = useTokenBalancesResource();
  return useAtomRefresh(resource);
};
