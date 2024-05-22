import { getTokenBalances } from "@sk-widget/common/get-token-balances";
import { tokenString } from "@sk-widget/domain";
import { getInitialYield } from "@sk-widget/domain/types/stake";
import { getMultipleYields } from "@sk-widget/hooks/api/use-multi-yields";
import { getInitialQueryParams } from "@sk-widget/hooks/use-init-query-params";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import type { TokenDto } from "@stakekit/api-hooks";
import {
  useTokenGetTokensHook,
  useTokenTokenBalancesScanHook,
  useYieldYieldOpportunityHook,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";

export const useInitYield = ({
  selectedToken,
}: {
  selectedToken: Maybe<TokenDto>;
}) => {
  const getTokenBalancesMap = useGetTokenBalancesMap();
  const { isLedgerLive, isConnected, network, additionalAddresses, address } =
    useSKWallet();
  const queryClient = useSKQueryClient();
  const yieldYieldOpportunity = useYieldYieldOpportunityHook();
  const tokenGetTokens = useTokenGetTokensHook();
  const tokenTokenBalancesScan = useTokenTokenBalancesScanHook();

  return useQuery({
    staleTime: Number.POSITIVE_INFINITY,
    queryKey: [
      "init-yield",
      isConnected,
      network,
      additionalAddresses,
      address,
      selectedToken.extract(),
    ],
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          selectedToken.toEither(new Error("no token selected"))
        ).chain((token) =>
          getTokenBalances({
            additionalAddresses,
            address,
            network,
            queryClient,
            tokenGetTokens,
            tokenTokenBalancesScan,
          })
            .chain((val) =>
              EitherAsync.liftEither(
                Maybe.fromNullable(
                  getTokenBalancesMap(val).get(tokenString(token))
                ).toEither(new Error("could not get token balance"))
              )
            )
            .chain((val) =>
              getInitialQueryParams({
                isLedgerLive,
                queryClient,
                yieldYieldOpportunity,
              }).chain((initParams) =>
                getMultipleYields({
                  isConnected,
                  isLedgerLive,
                  queryClient,
                  yieldYieldOpportunity,
                  network,
                  yieldIds: val.availableYields,
                }).chain((multipleYields) =>
                  EitherAsync.liftEither(
                    getInitialYield({
                      initQueryParams: Maybe.fromNullable(initParams),
                      yieldDtos: multipleYields,
                      tokenBalanceAmount: new BigNumber(val.amount),
                    }).toEither(new Error("could not get initial yield"))
                  )
                )
              )
            )
        )
      ).unsafeCoerce(),
  });
};
