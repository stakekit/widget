import {
  coinbaseWallet,
  injectedWallet,
  omniWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
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
import { getNetworkLogo, isMobile } from "../../utils";
import { EvmNetworks } from "@stakekit/common";
import { EvmChainsMap } from "../../domain/types/chains";

export const evmChainMap: EvmChainsMap = {
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
};

export const evmChains = Object.values(evmChainMap).map(
  (val) => val.wagmiChain
);

export const connector = {
  groupName: "Ethereum",
  wallets: [
    injectedWallet({ chains: evmChains, shimDisconnect: !isMobile() }),
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
  ],
};
