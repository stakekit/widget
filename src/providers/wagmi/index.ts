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

const queryFn = async () =>
  getEvmConfig()
    .chain((val) =>
      getCosmosConfig().map((cosmosConfig) => ({
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
              evmConfig.connector,
              cosmosConfig.connector,
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

export const getWagmiConfig = () =>
  queryClient.fetchQuery({ staleTime, queryKey, queryFn });

export const useWagmiConfig = () => useQuery({ staleTime, queryKey, queryFn });

export const defaultConfig = (() => {
  const { publicClient, webSocketPublicClient } = configureChains(
    [mainnet], // must use at least one chain
    [publicProvider()]
  );

  return createConfig({
    autoConnect: true,
    publicClient,
    webSocketPublicClient,
  });
})();
