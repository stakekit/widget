import { EitherAsync, Maybe } from "purify-ts";
import { getInitialYield } from "../../domain/types/stake";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";
import { useQuery } from "@tanstack/react-query";
import { useSKWallet } from "../../providers/sk-wallet";
import { useSKQueryClient } from "../../providers/query-client";
import type { TokenDto } from "@stakekit/api-hooks";
import {
  useTokenGetTokensHook,
  useTokenTokenBalancesScanHook,
  useYieldYieldOpportunityHook,
} from "@stakekit/api-hooks";
import { getMultipleYields } from "../../hooks/api/use-multi-yields";
import { getTokenBalances } from "../../common/get-token-balances";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";
import { tokenString } from "../../domain";
import BigNumber from "bignumber.js";

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
    staleTime: Infinity,
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
