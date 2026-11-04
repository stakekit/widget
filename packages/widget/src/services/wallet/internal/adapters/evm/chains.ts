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
import {
  getWalletRoutingId,
  type WalletEvmNetwork,
} from "../../../../../domain/wallet/network";
import { getNetworkLogo } from "../../../network-assets";
import type { Chain } from "../../../wallet-descriptors";

type EvmChainEntry<Key extends WalletEvmNetwork> = {
  type: "evm";
  network: Key;
  wagmiChain: Chain;
};

export type EvmChainsMap = {
  [Key in WalletEvmNetwork]: EvmChainEntry<Key>;
};

const evmChainConfiguration: EvmChainsMap = {
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
      id: getWalletRoutingId("plasma"),
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
      id: getWalletRoutingId("katana"),
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
      id: getWalletRoutingId("hyperevm"),
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
      id: getWalletRoutingId("monad"),
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
      id: getWalletRoutingId("pharos"),
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

const withWalletRoutingId = <Key extends WalletEvmNetwork>(
  entry: EvmChainEntry<Key>
): EvmChainEntry<Key> => ({
  ...entry,
  wagmiChain: {
    ...entry.wagmiChain,
    id: getWalletRoutingId(entry.network),
  },
});

const configured = evmChainConfiguration;

export const evmChainsMap: EvmChainsMap = {
  ethereum: withWalletRoutingId(configured.ethereum),
  polygon: withWalletRoutingId(configured.polygon),
  optimism: withWalletRoutingId(configured.optimism),
  arbitrum: withWalletRoutingId(configured.arbitrum),
  "avalanche-c": withWalletRoutingId(configured["avalanche-c"]),
  celo: withWalletRoutingId(configured.celo),
  harmony: withWalletRoutingId(configured.harmony),
  viction: withWalletRoutingId(configured.viction),
  binance: withWalletRoutingId(configured.binance),
  base: withWalletRoutingId(configured.base),
  linea: withWalletRoutingId(configured.linea),
  core: withWalletRoutingId(configured.core),
  sonic: withWalletRoutingId(configured.sonic),
  "ethereum-hoodi": withWalletRoutingId(configured["ethereum-hoodi"]),
  "ethereum-goerli": withWalletRoutingId(configured["ethereum-goerli"]),
  "ethereum-sepolia": withWalletRoutingId(configured["ethereum-sepolia"]),
  unichain: withWalletRoutingId(configured.unichain),
  gnosis: withWalletRoutingId(configured.gnosis),
  plasma: withWalletRoutingId(configured.plasma),
  katana: withWalletRoutingId(configured.katana),
  hyperevm: withWalletRoutingId(configured.hyperevm),
  "monad-testnet": withWalletRoutingId(configured["monad-testnet"]),
  monad: withWalletRoutingId(configured.monad),
  robinhood: withWalletRoutingId(configured.robinhood),
  "robinhood-testnet": withWalletRoutingId(configured["robinhood-testnet"]),
  pharos: withWalletRoutingId(configured.pharos),
};
