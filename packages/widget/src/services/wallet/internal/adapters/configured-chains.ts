import type { Chain } from "@stakekit/rainbowkit";
import {
  getWalletProtocolFamily,
  getWalletRoutingId,
  type WalletMiscNetwork,
  type WalletProtocolFamily,
} from "../../../../domain/wallet/network";
import { getTokenLogo } from "../../network-assets";

export type MiscChainsMap = {
  [Key in WalletMiscNetwork]: {
    network: Key;
    protocolFamily: Exclude<
      WalletProtocolFamily,
      "evm" | "cosmos" | "substrate"
    >;
    wagmiChain: Chain;
  };
};

const near = {
  id: getWalletRoutingId("near"),
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
  id: getWalletRoutingId("tezos"),
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
  id: getWalletRoutingId("solana"),
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
  id: getWalletRoutingId("tron"),
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
  id: getWalletRoutingId("ton"),
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
  id: getWalletRoutingId("cardano"),
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
    network: "near",
    protocolFamily: getWalletProtocolFamily("near"),
    wagmiChain: near,
  },
  tezos: {
    network: "tezos",
    protocolFamily: getWalletProtocolFamily("tezos"),
    wagmiChain: tezos,
  },
  solana: {
    network: "solana",
    protocolFamily: getWalletProtocolFamily("solana"),
    wagmiChain: solana,
  },
  tron: {
    network: "tron",
    protocolFamily: getWalletProtocolFamily("tron"),
    wagmiChain: tron,
  },
  ton: {
    network: "ton",
    protocolFamily: getWalletProtocolFamily("ton"),
    wagmiChain: ton,
  },
  cardano: {
    network: "cardano",
    protocolFamily: getWalletProtocolFamily("cardano"),
    wagmiChain: cardano,
  },
};
