import type { SKWallet } from "@sk-widget/domain/types/wallet";
import type { SettingsProps } from "@sk-widget/providers/settings/types";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import { getDefaultTokens } from "../hooks/api/use-default-tokens";
import { getTokenBalancesScan } from "../hooks/api/use-token-balances-scan";

export const getTokenBalances = ({
  additionalAddresses,
  address,
  network,
  queryClient,
  tokensForEnabledYieldsOnly,
}: {
  additionalAddresses: SKWallet["additionalAddresses"];
  address: SKWallet["address"];
  queryClient: QueryClient;
  network: SKWallet["network"];
  tokensForEnabledYieldsOnly: SettingsProps["tokensForEnabledYieldsOnly"];
}) =>
  EitherAsync.fromPromise(() =>
    Promise.all([
      getDefaultTokens({
        queryClient,
        network: network ?? undefined,
        enabledYieldsOnly: tokensForEnabledYieldsOnly,
      }),
      EitherAsync.liftEither(
        Right({ additionalAddresses, address, network })
      ).chain(async (params) => {
        if (!params.address || !params.network) {
          return Right([]);
        }

        return getTokenBalancesScan({
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
