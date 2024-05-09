import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import { getTokenBalancesScan } from "../../hooks/api/use-token-balances-scan";
import { getDefaultTokens } from "../../hooks/api/use-default-tokens";
import { getInitialToken } from "../../domain/types/stake";
import type { TokenBalanceScanResponseDto } from "@stakekit/api-hooks";
import {
  useTokenGetTokensHook,
  useTokenTokenBalancesScanHook,
  useYieldYieldOpportunityHook,
} from "@stakekit/api-hooks";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";
import { getMultipleYields } from "../../hooks/api/use-multi-yields";
import { useQuery } from "@tanstack/react-query";
import { useSKWallet } from "../../providers/sk-wallet";
import { useSKQueryClient } from "../../providers/query-client";
import { tokenString } from "../../domain";
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
  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  const tokenGetTokens = useTokenGetTokensHook();
  const tokenTokenBalancesScan = useTokenTokenBalancesScanHook();

  return useQuery({
    staleTime: Infinity,
    queryKey: ["init-token", isConnected, network],
    queryFn: async () =>
      (
        await EitherAsync.fromPromise(() =>
          Promise.all([
            getDefaultTokens({ queryClient, network, tokenGetTokens }),
            EitherAsync.liftEither(
              Maybe.fromRecord({
                additionalAddresses: Maybe.fromNullable(additionalAddresses),
                address: Maybe.fromNullable(address),
                network: Maybe.fromNullable(network),
              }).toEither(null)
            )
              .chain((val) =>
                getTokenBalancesScan({
                  queryClient,
                  tokenTokenBalancesScan,
                  tokenBalanceScanDto: {
                    addresses: {
                      address: val.address,
                      additionalAddresses: val.additionalAddresses,
                    },
                    network: val.network,
                  },
                }).mapLeft(() => new Error("could not get token balances scan"))
              )
              .chainLeft(async (err) =>
                err ? Left(err) : Right([] as TokenBalanceScanResponseDto[])
              ),
          ]).then(([defaultTokens, tokenBalances]) =>
            defaultTokens.chain((d) =>
              tokenBalances.map((b) => ({
                defaultTokens: d,
                tokenBalancesScan: b,
              }))
            )
          )
        ).chain((val) =>
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
