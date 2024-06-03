import type {
  useTokenGetTokensHook,
  useTokenTokenBalancesScanHook,
} from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Right } from "purify-ts";
import type { SKWallet } from "../domain/types";
import { getDefaultTokens } from "../hooks/api/use-default-tokens";
import { getTokenBalancesScan } from "../hooks/api/use-token-balances-scan";

export const getTokenBalances = ({
  additionalAddresses,
  address,
  network,
  queryClient,
  tokenGetTokens,
  tokenTokenBalancesScan,
}: {
  additionalAddresses: SKWallet["additionalAddresses"];
  address: SKWallet["address"];
  queryClient: QueryClient;
  network: SKWallet["network"];
  tokenGetTokens: ReturnType<typeof useTokenGetTokensHook>;
  tokenTokenBalancesScan: ReturnType<typeof useTokenTokenBalancesScanHook>;
}) =>
  EitherAsync.fromPromise(() =>
    Promise.all([
      getDefaultTokens({ queryClient, network, tokenGetTokens }),
      EitherAsync.liftEither(
        Right({ additionalAddresses, address, network })
      ).chain(async (params) => {
        if (!params.address || !params.network) {
          return Right([]);
        }

        return getTokenBalancesScan({
          queryClient,
          tokenTokenBalancesScan,
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
