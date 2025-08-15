import { MiscNetworks } from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";
import type { KebabToCamelCase } from "../../../types/utils";
import { getTokenLogo } from "../../../utils";

const supportedMiscChains = [
  MiscNetworks.Near,
  MiscNetworks.Tezos,
  MiscNetworks.Solana,
  MiscNetworks.Tron,
  MiscNetworks.Ton,
] as const;

export const supportedMiscChainsSet = new Set(supportedMiscChains);

export type SupportedMiscChains = (typeof supportedMiscChains)[number];

export type MiscChainsMap = {
  [Key in SupportedMiscChains]: {
    type: "misc";
    skChainName: Key;
    wagmiChain: Chain;
  };
};

const near = {
  id: 397,
  name: "NEAR Protocol",
  iconUrl: getTokenLogo("near"),
  nativeCurrency: {
    decimals: 24,
    name: "Near",
    symbol: "NEAR",
  },
  rpcUrls: {
    public: { http: ["https://rpc.mainnet.near.org"] },
    default: { http: ["https://rpc.mainnet.near.org"] },
  },
} as const satisfies Chain;

const tezos = {
  id: 1729,
  name: "Tezos",
  iconUrl: getTokenLogo("xtz"),
  nativeCurrency: {
    decimals: 6,
    name: "Tezos",
    symbol: "XTZ",
  },
  rpcUrls: {
    public: { http: ["https://rpc.tzbeta.net/"] },
    default: { http: ["https://rpc.tzbeta.net/"] },
  },
} as const satisfies Chain;

export const solana = {
  id: 501,
  name: "Solana",
  iconUrl: getTokenLogo("sol"),
  nativeCurrency: {
    decimals: 9,
    name: "Solana",
    symbol: "SOL",
  },
  rpcUrls: {
    public: { http: ["https://api.mainnet-beta.solana.com/"] },
    default: { http: ["https://api.mainnet-beta.solana.com/"] },
  },
} as const satisfies Chain;

export const tron = {
  id: 79,
  name: "Tron",
  iconUrl: getTokenLogo("trx"),
  nativeCurrency: {
    decimals: 6,
    name: "Tron",
    symbol: "TRX",
  },
  rpcUrls: {
    public: { http: ["https://api.trongrid.io"] },
    default: { http: ["https://api.trongrid.io"] },
  },
} as const satisfies Chain;

export const ton = {
  id: 3412,
  name: "Ton",
  iconUrl: getTokenLogo("ton"),
  nativeCurrency: {
    decimals: 9,
    name: "Toncoin",
    symbol: "TON",
  },
  rpcUrls: {
    public: { http: ["https://ton.nownodes.io"] },
    default: { http: ["https://ton.nownodes.io"] },
  },
} as const satisfies Chain;

export const miscChainsMap: MiscChainsMap = {
  [MiscNetworks.Near]: {
    type: "misc",
    skChainName: MiscNetworks.Near,
    wagmiChain: near,
  },
  [MiscNetworks.Tezos]: {
    type: "misc",
    skChainName: MiscNetworks.Tezos,
    wagmiChain: tezos,
  },
  [MiscNetworks.Solana]: {
    type: "misc",
    skChainName: MiscNetworks.Solana,
    wagmiChain: solana,
  },
  [MiscNetworks.Tron]: {
    type: "misc",
    skChainName: MiscNetworks.Tron,
    wagmiChain: tron,
  },
  [MiscNetworks.Ton]: {
    type: "misc",
    skChainName: MiscNetworks.Ton,
    wagmiChain: ton,
  },
};

export enum MiscChainIds {
  Near = 397,
  Tezos = 1729,
  Solana = 501,
  Tron = 79,
  Ton = 3412,
}

MiscChainIds satisfies Record<
  Capitalize<KebabToCamelCase<SupportedMiscChains>>,
  number
>;
