import { yieldYieldBalancesScan } from "@stakekit/api-hooks";
import { UseQueryOptions, useQuery } from "@tanstack/react-query";
import { EitherAsync } from "purify-ts";
import { useSKWallet } from "../wallet/use-sk-wallet";

export const useYieldYieldBalancesScan = (
  opts?: Omit<
    UseQueryOptions<Awaited<ReturnType<typeof yieldYieldBalancesScan>>>,
    "queryKey" | "queryFn" | "initialData"
  >
) => {
  const { network, address, additionalAddresses } = useSKWallet();

  return useQuery(
    ["yield-balances-scan", network, address, additionalAddresses],
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
