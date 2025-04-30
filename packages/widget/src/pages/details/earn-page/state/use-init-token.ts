import { getTokenBalances } from "@sk-widget/common/get-token-balances";
import { tokenString } from "@sk-widget/domain";
import { getInitialToken } from "@sk-widget/domain/types/stake";
import { getFirstEligibleYield } from "@sk-widget/hooks/api/use-multi-yields";
import { getInitParams } from "@sk-widget/hooks/use-init-params";
import { usePositionsData } from "@sk-widget/hooks/use-positions-data";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useSettings } from "@sk-widget/providers/settings";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import { useQuery } from "@tanstack/react-query";
import { BigNumber } from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";

/**
 *
 * @summary Get init token + loads its available yields
 */
export const useInitToken = () => {
  const getTokenBalancesMap = useGetTokenBalancesMap();
  const { isLedgerLive, isConnected, network, additionalAddresses, address } =
    useSKWallet();
  const queryClient = useSKQueryClient();
  const { data: positionsData } = usePositionsData();

  const { externalProviders, tokensForEnabledYieldsOnly } = useSettings();

  return useQuery({
    staleTime: Number.POSITIVE_INFINITY,
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
          tokensForEnabledYieldsOnly,
        }).chain((val) =>
          getInitParams({
            isLedgerLive,
            queryClient,
            externalProviders,
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
                  getFirstEligibleYield({
                    isConnected,
                    isLedgerLive,
                    queryClient,
                    network,
                    yieldIds: tokenBalance.availableYields,
                    initParams: initParams,
                    positionsData: positionsData,
                    tokenBalanceAmount: new BigNumber(tokenBalance.amount),
                  })
                )
                .map(() => token)
            )
          )
        )
      ).unsafeCoerce(),
  });
};
