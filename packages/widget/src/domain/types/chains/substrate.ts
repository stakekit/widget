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
  },
  [SubstrateNetworks.Bittensor]: {
    type: "substrate",
    skChainName: SubstrateNetworks.Bittensor,
    wagmiChain: bittensor,
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
