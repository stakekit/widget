import { getTokenBalances } from "@sk-widget/common/get-token-balances";
import { tokenString } from "@sk-widget/domain";
import { getFirstEligibleYield } from "@sk-widget/hooks/api/use-multi-yields";
import { getInitParams } from "@sk-widget/hooks/use-init-params";
import { usePositionsData } from "@sk-widget/hooks/use-positions-data";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useSettings } from "@sk-widget/providers/settings";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import type { TokenDto } from "@stakekit/api-hooks";
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
  const { externalProviders, tokensForEnabledYieldsOnly } = useSettings();
  const { data: positionsData } = usePositionsData();

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
                })
              )
            )
        )
      ).unsafeCoerce(),
  });
};
