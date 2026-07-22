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
  hoodi,
  linea,
  mainnet,
  monadTestnet,
  optimism,
  plasmaTestnet,
  polygon,
  sepolia,
  sonic,
  unichain,
  viction,
} from "viem/chains";
import { EvmChainIds } from "../../../public-api/types";
import { getNetworkLogo } from "../../../shared/lib/general";
import type { KebabToCamelCase } from "../../../shared/types/utils";
import { EvmNetworks } from "./networks";

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
  EvmNetworks.EthereumHoodi,
  EvmNetworks.Base,
  EvmNetworks.Linea,
  EvmNetworks.Core,
  EvmNetworks.Sonic,
  EvmNetworks.EthereumSepolia,
  EvmNetworks.Unichain,
  EvmNetworks.Katana,
  EvmNetworks.Gnosis,
  EvmNetworks.HyperEVM,
  EvmNetworks.Plasma,
  EvmNetworks.Monad,
  EvmNetworks.MonadTestnet,
  EvmNetworks.Pharos,
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
  [EvmNetworks.EthereumHoodi]: {
    type: "evm",
    skChainName: EvmNetworks.EthereumHoodi,
    wagmiChain: {
      ...hoodi,
      iconUrl: getNetworkLogo(EvmNetworks.EthereumHoodi),
    },
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
  [EvmNetworks.Plasma]: {
    type: "evm",
    skChainName: EvmNetworks.Plasma,
    wagmiChain: {
      id: 9745,
      name: "Plasma",
      iconUrl: getNetworkLogo(EvmNetworks.Plasma),
      nativeCurrency: plasmaTestnet.nativeCurrency,
      rpcUrls: {
        default: {
          http: ["https://rpc.plasma.to"],
        },
      },
    },
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
  [EvmNetworks.HyperEVM]: {
    type: "evm",
    skChainName: EvmNetworks.HyperEVM,
    wagmiChain: {
      id: 999,
      name: "HyperEVM",
      iconUrl: getNetworkLogo(EvmNetworks.HyperEVM),
      nativeCurrency: {
        name: "Ethereum",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ["https://rpc.hyperliquid.xyz/evm"],
        },
      },
    },
  },
  [EvmNetworks.MonadTestnet]: {
    type: "evm",
    skChainName: EvmNetworks.MonadTestnet,
    wagmiChain: {
      ...monadTestnet,
      iconUrl: getNetworkLogo(EvmNetworks.MonadTestnet),
    },
  },
  [EvmNetworks.Monad]: {
    type: "evm",
    skChainName: EvmNetworks.Monad,
    wagmiChain: {
      id: 143,
      name: "Monad",
      iconUrl: getNetworkLogo(EvmNetworks.Monad),
      nativeCurrency: {
        name: "Monad",
        symbol: "MON",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: [
            "https://rpc-mainnet.monadinfra.com/rpc/wibIOSEgRVbSCBJwHBho3mLEQODJvzd2",
          ],
        },
      },
    },
  },
  [EvmNetworks.Pharos]: {
    type: "evm",
    skChainName: EvmNetworks.Pharos,
    wagmiChain: {
      id: 1672,
      name: "Pharos",
      iconUrl: getNetworkLogo(EvmNetworks.Pharos),
      nativeCurrency: {
        name: "PROS",
        symbol: "PROS",
        decimals: 18,
      },
      rpcUrls: {
        default: {
          http: ["https://rpc.pharos.xyz"],
        },
      },
      blockExplorers: {
        default: {
          name: "Pharos Explorer",
          url: "https://pharosscan.xyz",
        },
      },
    },
  },
};

EvmChainIds satisfies Record<
  Capitalize<KebabToCamelCase<SupportedEvmChain>>,
  number
>;
