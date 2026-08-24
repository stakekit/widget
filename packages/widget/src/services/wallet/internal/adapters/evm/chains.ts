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
  robinhood,
  robinhoodTestnet,
  sepolia,
  sonic,
  unichain,
  viction,
} from "viem/chains";
import type { WalletEvmNetwork } from "../../../../../domain/wallet/network";
import { EvmChainIds } from "../../../../../public-api/types";
import type { KebabToCamelCase } from "../../../../../shared/type-helpers";
import { getNetworkLogo } from "../../../network-assets";

export type EvmChainsMap = {
  [Key in WalletEvmNetwork]: {
    type: "evm";
    network: Key;
    wagmiChain: Chain;
  };
};

export const evmChainsMap: EvmChainsMap = {
  ethereum: {
    type: "evm",
    network: "ethereum",
    wagmiChain: mainnet,
  },
  polygon: {
    type: "evm",
    network: "polygon",
    wagmiChain: polygon,
  },
  optimism: {
    type: "evm",
    network: "optimism",
    wagmiChain: optimism,
  },
  arbitrum: {
    type: "evm",
    network: "arbitrum",
    wagmiChain: arbitrum,
  },
  "avalanche-c": {
    type: "evm",
    network: "avalanche-c",
    wagmiChain: avalanche,
  },
  celo: {
    type: "evm",
    network: "celo",
    wagmiChain: {
      ...celo,
      iconUrl: getNetworkLogo("celo"),
    },
  },
  harmony: {
    type: "evm",
    network: "harmony",
    wagmiChain: {
      ...harmonyOne,
      iconUrl: getNetworkLogo("harmony"),
    },
  },
  viction: {
    type: "evm",
    network: "viction",
    wagmiChain: {
      ...viction,
      iconUrl: getNetworkLogo("viction"),
    },
  },
  binance: {
    type: "evm",
    network: "binance",
    wagmiChain: { ...bsc, name: "BNB Chain" },
  },
  base: {
    type: "evm",
    network: "base",
    wagmiChain: base,
  },
  linea: {
    type: "evm",
    network: "linea",
    wagmiChain: {
      ...linea,
      iconUrl: getNetworkLogo("linea"),
    },
  },
  core: {
    type: "evm",
    network: "core",
    wagmiChain: {
      ...coreDao,
      name: "Core",
      iconUrl: getNetworkLogo("core"),
    },
  },
  sonic: {
    type: "evm",
    network: "sonic",
    wagmiChain: {
      ...sonic,
      name: "Sonic",
      iconUrl: getNetworkLogo("sonic"),
    },
  },
  "ethereum-hoodi": {
    type: "evm",
    network: "ethereum-hoodi",
    wagmiChain: {
      ...hoodi,
      iconUrl: getNetworkLogo("ethereum-hoodi"),
    },
  },
  "ethereum-goerli": {
    type: "evm",
    network: "ethereum-goerli",
    wagmiChain: goerli,
  },
  "ethereum-sepolia": {
    type: "evm",
    network: "ethereum-sepolia",
    wagmiChain: sepolia,
  },
  unichain: {
    type: "evm",
    network: "unichain",
    wagmiChain: unichain,
  },
  gnosis: {
    type: "evm",
    network: "gnosis",
    wagmiChain: gnosis,
  },
  plasma: {
    type: "evm",
    network: "plasma",
    wagmiChain: {
      id: 9745,
      name: "Plasma",
      iconUrl: getNetworkLogo("plasma"),
      nativeCurrency: plasmaTestnet.nativeCurrency,
      rpcUrls: {
        default: {
          http: ["https://rpc.plasma.to"],
        },
      },
    },
  },
  katana: {
    type: "evm",
    network: "katana",
    wagmiChain: {
      id: 747474,
      name: "Katana",
      iconUrl: getNetworkLogo("katana"),
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
  hyperevm: {
    type: "evm",
    network: "hyperevm",
    wagmiChain: {
      id: 999,
      name: "HyperEVM",
      iconUrl: getNetworkLogo("hyperevm"),
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
  "monad-testnet": {
    type: "evm",
    network: "monad-testnet",
    wagmiChain: {
      ...monadTestnet,
      iconUrl: getNetworkLogo("monad-testnet"),
    },
  },
  monad: {
    type: "evm",
    network: "monad",
    wagmiChain: {
      id: 143,
      name: "Monad",
      iconUrl: getNetworkLogo("monad"),
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
  robinhood: {
    type: "evm",
    network: "robinhood",
    wagmiChain: {
      ...robinhood,
      iconUrl: getNetworkLogo("robinhood"),
    },
  },
  "robinhood-testnet": {
    type: "evm",
    network: "robinhood-testnet",
    wagmiChain: {
      ...robinhoodTestnet,
      iconUrl: getNetworkLogo("robinhood-testnet"),
    },
  },
  pharos: {
    type: "evm",
    network: "pharos",
    wagmiChain: {
      id: 1672,
      name: "Pharos",
      iconUrl: getNetworkLogo("pharos"),
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
  Capitalize<KebabToCamelCase<WalletEvmNetwork>>,
  number
>;
