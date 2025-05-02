import { getNetworkLogo } from "@sk-widget/utils";
import { SubstrateNetworks } from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";

const supportedSubstrateChains = [SubstrateNetworks.Polkadot] as const;

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

export const substrateChainsMap: SubstrateChainsMap = {
  [SubstrateNetworks.Polkadot]: {
    type: "substrate",
    skChainName: SubstrateNetworks.Polkadot,
    wagmiChain: polkadot,
  },
};

export enum SubstrateChainIds {
  Polkadot = 9999,
}
