import { configureChains, createConfig, mainnet } from "wagmi";
import { publicProvider } from "wagmi/providers/public";
import { getConfig as getEvmConfig } from "../ethereum/config";
import { getConfig as getCosmosConfig } from "../cosmos/config";
import { getConfig as getMiscConfig } from "../misc/config";
import { connectorsForWallets } from "@stakekit/rainbowkit";
import { ledgerLiveConnector } from "../ledger/ledger-connector";
import { queryClient } from "../../services/query-client";
import { config } from "../../config";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import { useSettings } from "../settings";

const queryFn = async (...opts: Parameters<typeof getEvmConfig>) =>
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

        return Promise.resolve({
          evmConfig,
          cosmosConfig,
          miscConfig,
          chains,
          wagmiConfig: createConfig({
            autoConnect: true,
            connectors: connectorsForWallets([
              ...Maybe.catMaybes([evmConfig.connector, cosmosConfig.connector]),
              ledgerLiveConnector,
            ]),
            publicClient,
            webSocketPublicClient,
          }),
        });
      },
      Left: (l) => Promise.reject(l),
    });

const queryKey = [config.appPrefix, "wagmi-config"];
const staleTime = Infinity;

export const getWagmiConfig = (...opts: Parameters<typeof queryFn>) =>
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

export const useWagmiConfig = () => {
  const { forceWalletConnectOnly } = useSettings();

  return useQuery({
    staleTime,
    queryKey,
    queryFn: () =>
      queryFn({ forceWalletConnectOnly: !!forceWalletConnectOnly }),
  });
};

export const defaultConfig = (() => {
  const { publicClient, webSocketPublicClient } = configureChains(
    [mainnet], // must use at least one chain
    [publicProvider()]
  );

  return createConfig({
    autoConnect: true,
    publicClient,
    webSocketPublicClient,
    connectors: [],
  });
})();
