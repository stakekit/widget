import { getNetworkLogo } from "@sk-widget/utils";
import { EvmNetworks } from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  celo,
  coreDao,
  goerli,
  harmonyOne,
  holesky,
  linea,
  mainnet,
  optimism,
  polygon,
  sonic,
  viction,
} from "viem/chains";

const supportedEVMChains = [
  EvmNetworks.AvalancheC,
  EvmNetworks.Arbitrum,
  EvmNetworks.Binance,
  EvmNetworks.Celo,
  EvmNetworks.Ethereum,
  EvmNetworks.EthereumGoerli,
  EvmNetworks.Harmony,
  EvmNetworks.Optimism,
  EvmNetworks.Polygon,
  EvmNetworks.Viction,
  EvmNetworks.EthereumHolesky,
  EvmNetworks.Base,
  EvmNetworks.Linea,
  EvmNetworks.Core,
  EvmNetworks.Sonic,
] as const;

export const supportedEVMChainsSet = new Set(supportedEVMChains);

export type SupportedEvmChain = (typeof supportedEVMChains)[number];

export type EvmChainsMap = {
  [Key in SupportedEvmChain]: {
    type: "evm";
    skChainName: Key;
    wagmiChain: Chain;
  };
};

export const evmChainsMap: EvmChainsMap = {
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
      ...coreDao,
      name: "Core",
      iconUrl: getNetworkLogo(EvmNetworks.Core),
    },
  },
  [EvmNetworks.Sonic]: {
    type: "evm",
    skChainName: EvmNetworks.Sonic,
    wagmiChain: {
      ...sonic,
      name: "Sonic",
      iconUrl: getNetworkLogo(EvmNetworks.Sonic),
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
};

export enum EvmChainIds {
  Ethereum = 1,
  Polygon = 137,
  Optimism = 10,
  Arbitrum = 42_161,
  AvalancheC = 43_114,
  Celo = 42_220,
  Harmony = 1_666_600_000,
  Viction = 88,
  Binance = 56,
  Base = 8453,
  Linea = 59_144,
  Core = 1116,
  Sonic = 146,
  EthereumHolesky = 17000,
  EthereumGoerli = 5,
}
