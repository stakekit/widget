import type { Chain } from "@stakekit/rainbowkit";
import {
  getProtocolChainIdentity,
  getWalletRoutingId,
  type WalletSubstrateNetwork,
} from "../../../../../domain/wallet/network";
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
  id: getWalletRoutingId("polkadot"),
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
  id: getWalletRoutingId("bittensor"),
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
    genesisHash: getProtocolChainIdentity("polkadot").genesisHash,
    ss58Format: 0,
  },
  bittensor: {
    type: "substrate",
    network: "bittensor",
    wagmiChain: bittensor,
    genesisHash: getProtocolChainIdentity("bittensor").genesisHash,
    ss58Format: 0,
  },
};
