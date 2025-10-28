import { SubstrateNetworks } from "@stakekit/common";
import type { Chain, ChainGroup } from "@stakekit/rainbowkit";
import type { KebabToCamelCase } from "../../../types/utils";
import { getNetworkLogo } from "../../../utils";

const supportedSubstrateChains = [
  SubstrateNetworks.Polkadot,
  SubstrateNetworks.Bittensor,
] as const;

export const supportedSubstrateChainsSet = new Set(supportedSubstrateChains);

export type SupportedSubstrateChains =
  (typeof supportedSubstrateChains)[number];

export type SubstrateChainsMap = {
  [Key in SupportedSubstrateChains]: {
    type: "substrate";
    skChainName: Key;
    wagmiChain: Chain;
    genesisHash: string;
    ss58Format: number;
  };
};

export const polkadot = {
  id: 9999,
  name: "Polkadot",
  iconUrl: getNetworkLogo(SubstrateNetworks.Polkadot),
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

export const bittensor = {
  id: 558,
  name: "Bittensor",
  iconUrl: getNetworkLogo(SubstrateNetworks.Bittensor),
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
  [SubstrateNetworks.Polkadot]: {
    type: "substrate",
    skChainName: SubstrateNetworks.Polkadot,
    wagmiChain: polkadot,
    genesisHash:
      "0x91b171bb158e2d3848fa23a9f1c25182fb8e20313b2c1eb49219da7a70ce90c3",
    ss58Format: 0,
  },
  [SubstrateNetworks.Bittensor]: {
    type: "substrate",
    skChainName: SubstrateNetworks.Bittensor,
    wagmiChain: bittensor,
    genesisHash:
      "0x2f0555cc76fc2840a25a6ea3b9637146806f1f44b090c175ffde2a7e5ab36c03",
    ss58Format: 0,
  },
};

export enum SubstrateChainIds {
  Polkadot = 9999,
  Bittensor = 558,
}

SubstrateChainIds satisfies Record<
  Capitalize<KebabToCamelCase<SupportedSubstrateChains>>,
  number
>;

export const polkadotChainGroup = {
  iconUrl: getNetworkLogo(SubstrateNetworks.Polkadot),
  title: "Polkadot",
  id: "polkadot",
} satisfies ChainGroup;
