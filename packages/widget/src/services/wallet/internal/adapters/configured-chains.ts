import type { Chain } from "@stakekit/rainbowkit";
import type { WalletMiscNetwork } from "../../../../domain/wallet/network";
import { MiscChainIds } from "../../../../public-api/types";
import type { KebabToCamelCase } from "../../../../shared/type-helpers";
import { getTokenLogo } from "../../network-assets";

export type MiscChainsMap = {
  [Key in WalletMiscNetwork]: {
    type: "misc";
    network: Key;
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

export const cardano = {
  id: 2000,
  name: "Cardano",
  iconUrl: getTokenLogo("ada"),
  nativeCurrency: {
    decimals: 6,
    name: "Cardano",
    symbol: "ADA",
  },
  rpcUrls: {
    public: { http: [] },
    default: { http: [] },
  },
} as const satisfies Chain;

export const miscChainsMap: MiscChainsMap = {
  near: {
    type: "misc",
    network: "near",
    wagmiChain: near,
  },
  tezos: {
    type: "misc",
    network: "tezos",
    wagmiChain: tezos,
  },
  solana: {
    type: "misc",
    network: "solana",
    wagmiChain: solana,
  },
  tron: {
    type: "misc",
    network: "tron",
    wagmiChain: tron,
  },
  ton: {
    type: "misc",
    network: "ton",
    wagmiChain: ton,
  },
  cardano: {
    type: "misc",
    network: "cardano",
    wagmiChain: cardano,
  },
};

MiscChainIds satisfies Record<
  Capitalize<KebabToCamelCase<WalletMiscNetwork>>,
  number
>;
