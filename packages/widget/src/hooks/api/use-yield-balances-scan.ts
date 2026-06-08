import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { Maybe } from "purify-ts";
import { useCallback, useMemo } from "react";
import type {
  YieldBalancesByYieldDto,
  YieldBalancesRequestDto,
} from "../../domain/types/positions";
import { useApiClient } from "../../providers/api/api-client-provider";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";
import { useActionHistoryData } from "../../providers/stake-history";
import { useInvalidateQueryNTimes } from "../use-invalidate-query-n-times";

export const useYieldBalancesScan = <T = YieldBalancesByYieldDto[]>(opts?: {
  select?: (data: YieldBalancesByYieldDto[]) => T;
  // biome-ignore lint/suspicious/noExplicitAny: fix later
}): UseQueryResult<T, any> => {
  const apiClient = useApiClient();
  const { network, address } = useSKWallet();

  const actionHistoryData = useActionHistoryData();

  const lastActionTimestamp = useMemo(
    () => actionHistoryData.map((v) => v.timestamp).extractNullable(),
    [actionHistoryData]
  );

  const param = useMemo(
    () =>
      Maybe.fromRecord({
        address: Maybe.fromNullable(address),
        network: Maybe.fromNullable(network),
      }).mapOrDefault<{ dto: YieldBalancesRequestDto; enabled: boolean }>(
        (val) => ({
          enabled: true,
          dto: {
            queries: [
              {
                address: val.address,
                network:
                  val.network as YieldBalancesRequestDto["queries"][number]["network"],
              },
            ],
          },
        }),
        {
          enabled: false,
          dto: {
            queries: [{ address: "", network: "ethereum" }],
          },
        }
      ),
    [address, network]
  );

  const res = useQuery({
    queryKey: getYieldYieldBalancesScanQueryKey(param.dto),
    enabled: param.enabled,
    refetchInterval: 1000 * 60,
    queryFn: ({ signal }) =>
      apiClient
        .withOptions({ signal })
        .yield.YieldsControllerGetAggregateBalances({
          payload: param.dto,
        }),
    select: (data) => {
      const items = data.items as YieldBalancesByYieldDto[];

      if (opts?.select) {
        return opts.select(items);
      }

      return items as T;
    },
  });

  /**
   * This is a hack to make sure that the yield balances are updated after a transaction
   */
  useInvalidateQueryNTimes({
    enabled: !!lastActionTimestamp,
    key: ["yield-balances-refetch", lastActionTimestamp],
    queryKey: getYieldYieldBalancesScanQueryKey(),
    waitMs: 4000,
    shouldRefetch: () =>
      !!lastActionTimestamp && Date.now() - lastActionTimestamp < 1000 * 12,
  });

  return res;
};

export const useInvalidateYieldBalances = () => {
  const queryClient = useSKQueryClient();

  return useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: getYieldYieldBalancesScanQueryKey(),
      }),
    [queryClient]
  );
};

const getYieldYieldBalancesScanQueryKey = (dto?: YieldBalancesRequestDto) =>
  ["post", "/v1/yields/balances", ...(dto ? [dto] : [])] as const;
