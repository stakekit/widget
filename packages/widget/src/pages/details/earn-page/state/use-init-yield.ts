import type { TokenDto } from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { EitherAsync, Maybe } from "purify-ts";
import { getTokenBalances } from "../../../../common/get-token-balances";
import { tokenString } from "../../../../domain";
import { getFirstEligibleYield } from "../../../../hooks/api/use-multi-yields";
import { getInitParams } from "../../../../hooks/use-init-params";
import { usePositionsData } from "../../../../hooks/use-positions-data";
import { useWhitelistedValidators } from "../../../../hooks/use-whitelisted-validators";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useGetTokenBalancesMap } from "./use-get-token-balances-map";

export const useInitYield = ({
  selectedToken,
}: {
  selectedToken: Maybe<TokenDto>;
}) => {
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
  const {
    externalProviders,
    tokensForEnabledYieldsOnly,
    preferredTokenYieldsPerNetwork,
  } = useSettings();
  const { data: positionsData } = usePositionsData();

  const whitelistedValidatorAddresses = useWhitelistedValidators();

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
    enabled: !isConnecting,
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
            tokensForEnabledYieldsOnly,
          })
            .chain((val) =>
              EitherAsync.liftEither(
                Maybe.fromNullable(
                  getTokenBalancesMap(val).get(tokenString(token))
                ).toEither(new Error("could not get token balance"))
              )
            )
            .chain((val) =>
              getInitParams({
                isLedgerLive,
                queryClient,
                externalProviders,
                whitelistedValidatorAddresses,
              }).chain((initParams) =>
                getFirstEligibleYield({
                  isConnected,
                  isLedgerLive,
                  queryClient,
                  network,
                  yieldIds: val.availableYields,
                  initParams: initParams,
                  positionsData: positionsData,
                  tokenBalanceAmount: new BigNumber(val.amount),
                  whitelistedValidatorAddresses,
                  preferredTokenYieldsPerNetwork:
                    preferredTokenYieldsPerNetwork ?? null,
                })
              )
            )
        )
      ).unsafeCoerce(),
  });
};
