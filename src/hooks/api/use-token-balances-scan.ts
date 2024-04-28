import type { TokenBalanceScanDto } from "@stakekit/api-hooks";
import {
  getTokenTokenBalancesScanQueryKey,
  useTokenTokenBalancesScan,
} from "@stakekit/api-hooks";
import { Just, Maybe } from "purify-ts";
import { useCallback, useMemo } from "react";
import { useSKWallet } from "../../providers/sk-wallet";
import { useSKQueryClient } from "../../providers/query-client";

export const useTokenBalancesScan = () => {
  const {
    additionalAddresses,
    address,
    network,
    isLedgerLiveAccountPlaceholder,
  } = useSKWallet();

  const param = useMemo(
    () =>
      Maybe.fromRecord({
        additionalAddresses: Just(additionalAddresses ?? undefined),
        address: Maybe.fromNullable(address),
        network: Maybe.fromNullable(network),
      }).mapOrDefault<{ dto: TokenBalanceScanDto; enabled: boolean }>(
        (val) => ({
          enabled: !isLedgerLiveAccountPlaceholder,
          dto: {
            addresses: {
              address: val.address,
              additionalAddresses: val.additionalAddresses,
            },
            network: val.network,
          },
        }),
        {
          enabled: false,
          dto: {
            addresses: { address: "", additionalAddresses: undefined },
            network: "ethereum",
          },
        }
      ),
    [additionalAddresses, address, isLedgerLiveAccountPlaceholder, network]
  );

  return useTokenTokenBalancesScan(param.dto, {
    query: { enabled: param.enabled, refetchInterval: 1000 * 60 },
  });
};

export const useInvalidateTokenBalances = () => {
  const queryClient = useSKQueryClient();

  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: [
          getTokenTokenBalancesScanQueryKey({} as TokenBalanceScanDto)[0],
        ],
      }),
    [queryClient]
  );
};
