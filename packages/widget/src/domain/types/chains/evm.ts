import { EvmNetworks } from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";
import {
  arbitrum,
  avalanche,
  base,
  bsc,
  celo,
  coreDao,
  gnosis,
  goerli,
  harmonyOne,
  holesky,
  linea,
  mainnet,
  optimism,
  polygon,
  sepolia,
  sonic,
  unichain,
  viction,
} from "viem/chains";
import { getNetworkLogo } from "../../../utils";

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
  EvmNetworks.EthereumSepolia,
  EvmNetworks.Unichain,
  EvmNetworks.Katana,
  EvmNetworks.Gnosis,
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
    wagmiChain: {
      ...viction,
      iconUrl: getNetworkLogo(EvmNetworks.Viction),
    },
  },
  [EvmNetworks.Binance]: {
    type: "evm",
    skChainName: EvmNetworks.Binance,
    wagmiChain: { ...bsc, name: "BNB Chain" },
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
  [EvmNetworks.EthereumSepolia]: {
    type: "evm",
    skChainName: EvmNetworks.EthereumSepolia,
    wagmiChain: sepolia,
  },
  [EvmNetworks.Unichain]: {
    type: "evm",
    skChainName: EvmNetworks.Unichain,
    wagmiChain: unichain,
  },
  [EvmNetworks.Gnosis]: {
    type: "evm",
    skChainName: EvmNetworks.Gnosis,
    wagmiChain: gnosis,
  },
  [EvmNetworks.Katana]: {
    type: "evm",
    skChainName: EvmNetworks.Katana,
    wagmiChain: {
      id: 747474,
      name: "Katana",
      iconUrl: getNetworkLogo(EvmNetworks.Katana),
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ["https://rpc.katana.network/"],
        },
      },
    },
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
  EthereumSepolia = 11_155_111,
  Unichain = 130,
  Katana = 747474,
}
