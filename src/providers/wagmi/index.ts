import { Chain, configureChains, createConfig, mainnet } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { getConfig as getEvmConfig } from "../ethereum/config";
import { getConfig as getCosmosConfig } from "../cosmos/config";
import { getConfig as getMiscConfig } from "../misc/config";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import { ledgerLiveConnector } from "../ledger/ledger-connector";
import { queryClient } from "../../services/query-client";
import { config } from "../../config";
import { UseQueryResult, useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { useSettings } from "../settings";
import { GetEitherAsyncRight } from "../../types";

const queryFn = async (
  ...opts: Parameters<typeof getEvmConfig>
): Promise<{
  evmConfig: GetEitherAsyncRight<ReturnType<typeof getEvmConfig>>;
  cosmosConfig: GetEitherAsyncRight<ReturnType<typeof getCosmosConfig>>;
  miscConfig: GetEitherAsyncRight<ReturnType<typeof getMiscConfig>>;
  chains: Chain[];
  wagmiConfig: ReturnType<typeof createConfig>;
}> =>
  getEvmConfig(...opts)
    .chain((val) =>
      getCosmosConfig(...opts).map((cosmosConfig) => ({
        evmConfig: val,
        cosmosConfig,
      }))
    )
    .chain((val) =>
      getMiscConfig().map((miscConfig) => ({ ...val, miscConfig }))
    )
    .caseOf({
      Right: ({ evmConfig, cosmosConfig, miscConfig }) => {
        const { chains, publicClient, webSocketPublicClient } = configureChains(
          [
            ...evmConfig.evmChains,
            ...cosmosConfig.cosmosWagmiChains,
            ...miscConfig.miscChains,
          ],
          [publicProvider()]
        );

        const wagmiConfig = createConfig({
          autoConnect: true,
          connectors: connectorsForWallets([
            ...Maybe.catMaybes([evmConfig.connector, cosmosConfig.connector]),
            ledgerLiveConnector,
          ]),
          publicClient,
          webSocketPublicClient,
        }) as ReturnType<typeof createConfig>;

        return Promise.resolve({
          evmConfig,
          cosmosConfig,
          miscConfig,
          chains,
          wagmiConfig,
        });
      },
      Left: (l) => Promise.reject(l),
    });

const queryKey = [config.appPrefix, "wagmi-config"];
const staleTime = Infinity;

export const getWagmiConfig = (
  ...opts: Parameters<typeof queryFn>
): EitherAsync<Error, Awaited<ReturnType<typeof queryFn>>> =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime,
      queryKey,
      queryFn: () => queryFn(...opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get wagmi config");
  });

export const useWagmiConfig = (): UseQueryResult<
  Awaited<ReturnType<typeof queryFn>>,
  Error
> => {
  const { forceWalletConnectOnly } = useSettings();

  return useQuery({
    staleTime,
    queryKey,
    queryFn: () =>
      queryFn({ forceWalletConnectOnly: !!forceWalletConnectOnly }),
  });
};

export const defaultConfig: ReturnType<typeof createConfig> = (() => {
  const { publicClient, webSocketPublicClient } = configureChains(
    [mainnet], // must use at least one chain
    [publicProvider()]
  );

  return createConfig({
    autoConnect: true,
    publicClient,
    webSocketPublicClient,
    connectors: [],
  }) as ReturnType<typeof createConfig>;
})();
