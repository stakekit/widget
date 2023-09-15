import { yieldYieldBalancesScan } from "@stakekit/api-hooks";
import {
  UseQueryOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useSKWallet } from "../wallet/use-sk-wallet";
import { useCallback } from "react";

const queryKey = "yield-balances-scan";

export const useYieldYieldBalancesScan = (
  opts?: Omit<
    UseQueryOptions<Awaited<ReturnType<typeof yieldYieldBalancesScan>>>,
    "queryKey" | "queryFn" | "initialData"
  >
) => {
  const { network, address, additionalAddresses } = useSKWallet();

  return useQuery(
    [queryKey, network, address, additionalAddresses],
    async () => {
      return await EitherAsync(() =>
        yieldYieldBalancesScan({
          network: network!,
          addresses: {
            address: address!,
            additionalAddresses: additionalAddresses ?? undefined,
          },
        })
      ).caseOf({
        Left(l) {
          return Promise.reject(l);
        },
        Right(r) {
          return Promise.resolve(r);
        },
      });
    },
    {
      enabled: !!(network && address),
      staleTime: 1000 * 60 * 5,
      ...opts,
    } as typeof opts
  );
};

export const useInvalidateYieldBalances = () => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [queryKey],
    });
  }, [queryClient]);
};
