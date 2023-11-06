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
import { EitherAsync, Maybe } from "purify-ts";
import { WalletList } from "@stakekit/rainbowkit";

const queryFn = async ({
  forceWalletConnectOnly,
}: {
  forceWalletConnectOnly: boolean;
}) =>
  getEnabledNetworks().caseOf({
    Right: (networks) => {
      const evmChainsMap: Partial<EvmChainsMap> = typeSafeObjectFromEntries(
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

      const connector: WalletList[number] = {
        groupName: "Ethereum",
        wallets: forceWalletConnectOnly
          ? [
              walletConnectWallet({
                chains: evmChains,
                options: {
                  projectId: config.walletConnectV2.projectId,
                  isNewChainsStale: true,
                },
                projectId: config.walletConnectV2.projectId,
              }),
            ]
          : [
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
              coinbaseWallet({
                chains: evmChains,
                appName: config.appName,
              }),
              ledgerWallet({
                chains: evmChains,
                projectId: config.walletConnectV2.projectId,
              }),
            ],
      };

      return Promise.resolve({
        evmChainsMap,
        evmChains,
        connector: Maybe.fromPredicate(() => !!evmChains.length, connector),
      });
    },
    Left: (l) => Promise.reject(l),
  });

export const getConfig = (...opts: Parameters<typeof queryFn>) =>
  EitherAsync(() =>
    queryClient.fetchQuery({
      staleTime: Infinity,
      queryKey: [config.appPrefix, "evm-config"],
      queryFn: () => queryFn(...opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get evm config");
  });
