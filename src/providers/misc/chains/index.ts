import { Chain } from "@stakekit/rainbowkit";
import { getTokenLogo } from "../../../utils";

export const near = {
  id: 397,
  name: "NEAR Protocol",
  iconUrl: getTokenLogo("near"),
  network: "near",
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

export const tezos = {
  id: 1729,
  name: "Tezos",
  iconUrl: getTokenLogo("xtz"),
  network: "NetXdQprcVkpaWU",
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
  network: "4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ",
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
  network: "tron",
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
