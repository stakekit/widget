import type { useYieldGetMyNetworksHook } from "@stakekit/api-hooks";
import { EvmNetworks } from "@stakekit/common";
import type { Chain, WalletList } from "@stakekit/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  // ledgerWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@stakekit/rainbowkit/wallets";
import type { QueryClient } from "@tanstack/react-query";
import { EitherAsync, Maybe } from "purify-ts";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  celo,
  coreDao as core,
  goerli,
  harmonyOne,
  holesky,
  linea,
  mainnet,
  optimism,
  polygon,
} from "wagmi/chains";
import { config } from "../../config";
import type { EvmChainsMap } from "../../domain/types/chains";
import {
  getNetworkLogo,
  getTokenLogo,
  typeSafeObjectEntries,
  typeSafeObjectFromEntries,
} from "../../utils";
import { getEnabledNetworks } from "../api/get-enabled-networks";
import { viction } from "./chains";

const queryFn = async ({
  queryClient,
  forceWalletConnectOnly,
  yieldGetMyNetworks,
}: {
  queryClient: QueryClient;
  forceWalletConnectOnly: boolean;
  yieldGetMyNetworks: ReturnType<typeof useYieldGetMyNetworksHook>;
}): Promise<{
  evmChainsMap: Partial<EvmChainsMap>;
  evmChains: Chain[];
  connector: Maybe<WalletList[number]>;
}> =>
  getEnabledNetworks({ queryClient, yieldGetMyNetworks }).caseOf({
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
          [EvmNetworks.Viction]: {
            type: "evm",
            skChainName: EvmNetworks.Viction,
            wagmiChain: viction,
          },
          [EvmNetworks.Binance]: {
            type: "evm",
            skChainName: EvmNetworks.Binance,
            wagmiChain: bsc,
          },
          [EvmNetworks.Base]: {
            type: "evm",
            skChainName: EvmNetworks.Base,
            wagmiChain: base,
          },
          [EvmNetworks.Linea]: {
            type: "evm",
            skChainName: EvmNetworks.Linea,
            wagmiChain: {
              ...linea,
              iconUrl: getNetworkLogo(EvmNetworks.Linea),
            },
          },
          [EvmNetworks.Core]: {
            type: "evm",
            skChainName: EvmNetworks.Core,
            wagmiChain: {
              ...core,
              name: "Core",
              iconUrl: getTokenLogo("core-dao"),
            },
          },
          [EvmNetworks.EthereumHolesky]: {
            type: "evm",
            skChainName: EvmNetworks.EthereumHolesky,
            wagmiChain: holesky,
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
          ? [walletConnectWallet]
          : [
              metaMaskWallet,
              injectedWallet,
              walletConnectWallet,
              rainbowWallet,
              coinbaseWallet,
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

export const getConfig = (opts: Parameters<typeof queryFn>[0]) =>
  EitherAsync(() =>
    opts.queryClient.fetchQuery({
      staleTime: Number.POSITIVE_INFINITY,
      queryKey: [config.appPrefix, "evm-config"],
      queryFn: () => queryFn(opts),
    })
  ).mapLeft((e) => {
    console.log(e);
    return new Error("Could not get evm config");
  });
