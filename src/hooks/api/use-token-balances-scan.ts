import type { TokenBalanceScanDto } from "@stakekit/api-hooks";
import { useTokenTokenBalancesScanHook } from "@stakekit/api-hooks";
import { getTokenTokenBalancesScanQueryKey } from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Just, Maybe } from "purify-ts";
import { useCallback, useMemo } from "react";
import { useSKQueryClient } from "../../providers/query-client";
import { useSKWallet } from "../../providers/sk-wallet";

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

  const tokenTokenBalancesScan = useTokenTokenBalancesScanHook();

  return useQuery({
    queryKey: getTokenTokenBalancesScanQueryKey(param.dto),
    enabled: param.enabled,
    refetchInterval: 1000 * 60,
    queryFn: async () =>
      (
        await queryFn({
          tokenBalanceScanDto: param.dto,
          tokenTokenBalancesScan,
        })
      ).unsafeCoerce(),
  });
};

export const getTokenBalancesScan = (
  params: Parameters<typeof queryFn>[0] & { queryClient: QueryClient }
) =>
  EitherAsync(() =>
    params.queryClient.fetchQuery({
      queryKey: getTokenTokenBalancesScanQueryKey(params.tokenBalanceScanDto),
      queryFn: async () => (await queryFn(params)).unsafeCoerce(),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("could not get multi yields");
  });

const queryFn = ({
  tokenBalanceScanDto,
  tokenTokenBalancesScan,
}: {
  tokenBalanceScanDto: TokenBalanceScanDto;
  tokenTokenBalancesScan: ReturnType<typeof useTokenTokenBalancesScanHook>;
}) =>
  EitherAsync(() => tokenTokenBalancesScan(tokenBalanceScanDto)).mapLeft(
    (e) => {
      console.log(e);
      return new Error("could not get token balances");
    }
  );

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
