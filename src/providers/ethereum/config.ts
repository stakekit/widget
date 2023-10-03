import {
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  omniWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import {
  mainnet,
  arbitrum,
  avalanche,
  celo,
  goerli,
  harmonyOne,
  optimism,
  polygon,
} from "wagmi/chains";
import { config } from "../../config";
import {
  getNetworkLogo,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";
import { EvmNetworks } from "@stakekit/common";
import { EvmChainsMap } from "../../domain/types/chains";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { queryClient } from "../../services/query-client";
import { EitherAsync } from "purify-ts";

export const getConfig = () =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime: Infinity,
      queryKey: [config.appPrefix, "evm-config"],
      queryFn: async () =>
        getEnabledNetworks().caseOf({
          Right: (networks) => {
            const evmChainsMap: EvmChainsMap = typeSafeObjectFromEntries(
              typeSafeObjectEntries<EvmChainsMap>({
                [EvmNetworks.Ethereum]: {
                  type: "evm",
                  skChainName: EvmNetworks.Ethereum,
                  wagmiChain: mainnet,
                },
                [EvmNetworks.Polygon]: {
                  type: "evm",
                  skChainName: EvmNetworks.Polygon,
                  wagmiChain: polygon,
                },
                [EvmNetworks.Optimism]: {
                  type: "evm",
                  skChainName: EvmNetworks.Optimism,
                  wagmiChain: optimism,
                },
                [EvmNetworks.Arbitrum]: {
                  type: "evm",
                  skChainName: EvmNetworks.Arbitrum,
                  wagmiChain: arbitrum,
                },
                [EvmNetworks.AvalancheC]: {
                  type: "evm",
                  skChainName: EvmNetworks.AvalancheC,
                  wagmiChain: avalanche,
                },
                [EvmNetworks.Celo]: {
                  type: "evm",
                  skChainName: EvmNetworks.Celo,
                  wagmiChain: {
                    ...celo,
                    iconUrl: getNetworkLogo(EvmNetworks.Celo),
                  },
                },
                [EvmNetworks.Harmony]: {
                  type: "evm",
                  skChainName: EvmNetworks.Harmony,
                  wagmiChain: {
                    ...harmonyOne,
                    iconUrl: getNetworkLogo(EvmNetworks.Harmony),
                  },
                },
                [EvmNetworks.EthereumGoerli]: {
                  type: "evm",
                  skChainName: EvmNetworks.EthereumGoerli,
                  wagmiChain: goerli,
                },
              }).filter(([_, v]) => networks.has(v.skChainName))
            );

            const evmChains = Object.values(evmChainsMap).map(
              (val) => val.wagmiChain
            );

            const connector = {
              groupName: "Ethereum",
              wallets: [
                injectedWallet({ chains: evmChains, shimDisconnect: true }),
                walletConnectWallet({
                  chains: evmChains,
                  options: {
                    projectId: config.walletConnectV2.projectId,
                    isNewChainsStale: true,
                  },
                  projectId: config.walletConnectV2.projectId,
                }),
                omniWallet({
                  chains: evmChains,
                  projectId: config.walletConnectV2.projectId,
                }),
                rainbowWallet({
                  chains: evmChains,
                  projectId: config.walletConnectV2.projectId,
                }),
                coinbaseWallet({ chains: evmChains, appName: config.appName }),
                ledgerWallet({
                  chains: evmChains,
                  projectId: config.walletConnectV2.projectId,
                }),
              ],
            };

            return Promise.resolve({
              evmChainsMap,
              evmChains,
              connector,
            });
          },
          Left: (l) => Promise.reject(l),
        }),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get evm config");
  });
