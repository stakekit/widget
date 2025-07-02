import { useQuery } from "@tanstack/react-query";
import { BigNumber } from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { getTokenBalances } from "../../../../common/get-token-balances";
import { tokenString } from "../../../../domain";
import { getInitialToken } from "../../../../domain/types/stake";
import { getFirstEligibleYield } from "../../../../hooks/api/use-multi-yields";
import { getInitParams } from "../../../../hooks/use-init-params";
import { usePositionsData } from "../../../../hooks/use-positions-data";
import { useWhitelistedValidators } from "../../../../hooks/use-whitelisted-validators";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";

/**
 *
 * @summary Get init token + loads its available yields
 */
export const useInitToken = () => {
  const getTokenBalancesMap = useGetTokenBalancesMap();
  const {
    isLedgerLive,
    isConnected,
    network,
    additionalAddresses,
    address,
    isConnecting,
  } = useSKWallet();
  const queryClient = useSKQueryClient();
  const { data: positionsData } = usePositionsData();

  const { externalProviders, tokensForEnabledYieldsOnly } = useSettings();

  const whitelistedValidatorAddresses = useWhitelistedValidators();

  return useQuery({
    staleTime: Number.POSITIVE_INFINITY,
    queryKey: [
      "init-token",
      isConnected,
      network,
      address,
      additionalAddresses,
    ],
    enabled: !isConnecting,
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
            whitelistedValidatorAddresses,
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
                    whitelistedValidatorAddresses,
                  })
                )
                .map(() => token)
            )
          )
        )
      ).unsafeCoerce(),
  });
};
