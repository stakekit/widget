import { EitherAsync, Maybe } from "purify-ts";
import { getInitialToken } from "@sk-widget/domain/types/stake";
import {
  useTokenGetTokensHook,
  useTokenTokenBalancesScanHook,
  useYieldYieldOpportunityHook,
} from "@stakekit/api-hooks";
import { getInitialQueryParams } from "@sk-widget/hooks/use-init-query-params";
import { useQuery } from "@tanstack/react-query";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { tokenString } from "@sk-widget/domain";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";
import { getTokenBalances } from "@sk-widget/common/get-token-balances";
import { getMultipleYields } from "@sk-widget/hooks/api/use-multi-yields";

/**
 *
 * @summary Get init token + loads its available yields
 */
export const useInitToken = () => {
  const getTokenBalancesMap = useGetTokenBalancesMap();
  const { isLedgerLive, isConnected, network, additionalAddresses, address } =
    useSKWallet();
  const queryClient = useSKQueryClient();
  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  const tokenGetTokens = useTokenGetTokensHook();
  const tokenTokenBalancesScan = useTokenTokenBalancesScanHook();

  return useQuery({
    staleTime: Infinity,
    queryKey: [
      "init-token",
      isConnected,
      network,
      address,
      additionalAddresses,
    ],
    queryFn: async () =>
      (
        await getTokenBalances({
          additionalAddresses,
          address,
          network,
          queryClient,
          tokenGetTokens,
          tokenTokenBalancesScan,
        }).chain((val) =>
          getInitialQueryParams({
            isLedgerLive,
            queryClient,
            yieldYieldOpportunity,
          }).chain((initParams) =>
            EitherAsync.liftEither(
              getInitialToken({
                defaultTokens: val.defaultTokens,
                tokenBalances: val.tokenBalancesScan,
                initQueryParams: Maybe.fromNullable(initParams),
              }).toEither(new Error("could not get initial token"))
            ).chain((token) =>
              EitherAsync.liftEither(
                Maybe.fromNullable(
                  getTokenBalancesMap(val).get(tokenString(token))
                ).toEither(new Error("could not get token balance"))
              )
                .chain((tokenBalance) =>
                  getMultipleYields({
                    isConnected,
                    isLedgerLive,
                    queryClient,
                    yieldYieldOpportunity,
                    network,
                    yieldIds: tokenBalance.availableYields,
                  })
                )
                .map(() => token)
            )
          )
        )
      ).unsafeCoerce(),
  });
};
