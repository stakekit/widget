import type { Chain } from "@stakekit/rainbowkit";
import type { WalletSubstrateNetwork } from "../../../../../domain/wallet/network";
import { SubstrateChainIds } from "../../../../../public-api/types";
import type { KebabToCamelCase } from "../../../../../shared/type-helpers";
import { getNetworkLogo } from "../../../network-assets";

export type SubstrateChainsMap = {
  [Key in WalletSubstrateNetwork]: {
    type: "substrate";
    network: Key;
    wagmiChain: Chain;
    genesisHash: string;
    ss58Format: number;
  };
};

const polkadot = {
  id: 9999,
  name: "Polkadot",
  iconUrl: getNetworkLogo("polkadot"),
  nativeCurrency: {
    decimals: 10,
    name: "Polkadot",
    symbol: "DOT",
  },
  rpcUrls: {
    public: {
      http: [
        "https://rpc.polkadot.io",
        "https://flashy-side-arrow.dot-mainnet.quiknode.pro/97d5006f66e37488fb9dc1575ef8960e3870dd0f/",
      ],
      webSocket: ["wss://rpc.polkadot.io"],
    },
    default: {
      http: [
        "https://rpc.polkadot.io",
        "https://flashy-side-arrow.dot-mainnet.quiknode.pro/97d5006f66e37488fb9dc1575ef8960e3870dd0f/",
      ],
      webSocket: ["wss://rpc.polkadot.io"],
    },
  },
} as const satisfies Chain;

const bittensor = {
  id: 558,
  name: "Bittensor",
  iconUrl: getNetworkLogo("bittensor"),
  nativeCurrency: {
    decimals: 9,
    name: "Bittensor Token",
    symbol: "TAO",
  },
  rpcUrls: {
    default: {
      http: ["https://entrypoint-finney.opentensor.ai"],
      webSocket: ["wss://entrypoint-finney.opentensor.ai"],
    },
  },
} as const satisfies Chain;

export const substrateChainsMap: SubstrateChainsMap = {
  polkadot: {
    type: "substrate",
    network: "polkadot",
    wagmiChain: polkadot,
    genesisHash:
      "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3",
    ss58Format: 0,
  },
  bittensor: {
    type: "substrate",
    network: "bittensor",
    wagmiChain: bittensor,
    genesisHash:
      "0x2f0555cc76fc2840a25a6ea3b9637146806f1f44b090c175ffde2a7e5ab36c03",
    ss58Format: 0,
  },
};

SubstrateChainIds satisfies Record<
  Capitalize<KebabToCamelCase<WalletSubstrateNetwork>>,
  number
>;
