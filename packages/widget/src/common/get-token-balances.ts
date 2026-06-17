import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import type { SKWallet } from "../domain/types/wallet";
import type { DashboardYieldCategory } from "../domain/types/yields";
import {
  getDefaultTokens,
  getYieldTypesForDashboardCategory,
} from "../hooks/api/use-default-tokens";
import { getTokenBalancesScan } from "../hooks/api/use-token-balances-scan";
import type { ApiClient } from "../providers/api/api-client";
import type { SettingsProps } from "../providers/settings/types";

export const getTokenBalances = ({
  additionalAddresses,
  address,
  apiClient,
  network,
  selectedDashboardYieldCategory,
  queryClient,
  tokensForEnabledYieldsOnly,
}: {
  additionalAddresses: SKWallet["additionalAddresses"];
  address: SKWallet["address"];
  apiClient: ApiClient;
  queryClient: QueryClient;
  network: SKWallet["network"];
  selectedDashboardYieldCategory?: DashboardYieldCategory | null;
  tokensForEnabledYieldsOnly: SettingsProps["tokensForEnabledYieldsOnly"];
}) =>
  EitherAsync.fromPromise(() =>
    Promise.all([
      getDefaultTokens({
        apiClient,
        queryClient,
        network: network ?? undefined,
        enabledYieldsOnly: tokensForEnabledYieldsOnly,
        yieldTypes: getYieldTypesForDashboardCategory(
          selectedDashboardYieldCategory
        ),
      }),
      EitherAsync.liftEither(
        Right({ additionalAddresses, address, network })
      ).chain(async (params) => {
        if (!params.address || !params.network) {
          return Right([]);
        }

        return getTokenBalancesScan({
          apiClient,
          queryClient,
          tokenBalanceScanDto: {
            addresses: {
              address: params.address,
              additionalAddresses: params.additionalAddresses ?? undefined,
            },
            network: params.network,
          },
        }).mapLeft(() => new Error("could not get token balances scan"));
      }),
    ]).then(([defaultTokens, tokenBalances]) =>
      defaultTokens.chain((d) =>
        tokenBalances.map((b) => ({
          defaultTokens: d,
          tokenBalancesScan: b,
        }))
      )
    )
  ).mapLeft(() => new Error("could not get tokens"));
