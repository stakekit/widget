import type { Currency, Families } from "@ledgerhq/wallet-api-client";
import type { WalletNetwork } from "../../../../../domain/wallet/network";

export type SupportedLedgerLiveFamilies = Extract<
  Families,
  | "ethereum"
  | "near"
  | "tezos"
  | "solana"
  | "cosmos"
  | "celo"
  | "tron"
  | "polkadot"
  | "ton"
>;

export const supportedLedgerFamiliesWithCurrency = {
  near: {
    "*": {
      currencyId: "near",
      family: "near",
      network: "near",
    },
  },
  tezos: {
    "*": {
      currencyId: "tezos",
      family: "tezos",
      network: "tezos",
    },
  },
  solana: {
    "*": {
      currencyId: "solana",
      family: "solana",
      network: "solana",
    },
  },
  tron: {
    "*": {
      currencyId: "tron",
      family: "tron",
      network: "tron",
    },
  },
  ton: {
    "*": {
      currencyId: "ton",
      family: "ton",
      network: "ton",
    },
  },
  polkadot: {
    "*": {
      currencyId: "assethub_polkadot",
      family: "polkadot",
      network: "polkadot",
    },
  },
  celo: {
    "*": {
      currencyId: "celo",
      family: "celo",
      network: "celo",
    },
  },
  ethereum: {
    ethereum: {
      currencyId: "ethereum",
      family: "ethereum",
      network: "ethereum",
    },
    polygon: {
      currencyId: "polygon",
      family: "ethereum",
      network: "polygon",
    },
    arbitrum: {
      currencyId: "arbitrum",
      family: "ethereum",
      network: "arbitrum",
    },
    optimism: {
      currencyId: "optimism",
      family: "ethereum",
      network: "optimism",
    },
    avalanche_c_chain: {
      currencyId: "avalanche_c_chain",
      family: "ethereum",
      network: "avalanche-c",
    },
    ethereum_hoodi: {
      currencyId: "ethereum_hoodi",
      family: "ethereum",
      network: "ethereum-hoodi",
    },
    bsc: {
      currencyId: "bsc",
      family: "ethereum",
      network: "binance",
    },
  },
  cosmos: {
    cosmos: {
      currencyId: "cosmos",
      family: "cosmos",
      network: "cosmos",
    },
    crypto_org: {
      currencyId: "crypto_org",
      family: "cosmos",
      network: "cronos",
    },
    osmo: {
      currencyId: "osmo",
      family: "cosmos",
      network: "osmosis",
    },
    coreum: {
      currencyId: "coreum",
      family: "cosmos",
      network: "coreum",
    },
    axelar: {
      currencyId: "axelar",
      family: "cosmos",
      network: "axelar",
    },
    stargaze: {
      currencyId: "stargaze",
      family: "cosmos",
      network: "stargaze",
    },
    secret_network: {
      currencyId: "secret_network",
      family: "cosmos",
      network: "secret",
    },
    umee: {
      currencyId: "umee",
      family: "cosmos",
      network: "umee",
    },
    desmos: {
      currencyId: "desmos",
      family: "cosmos",
      network: "desmos",
    },
    onomy: {
      currencyId: "onomy",
      family: "cosmos",
      network: "onomy",
    },
    quicksilver: {
      currencyId: "quicksilver",
      family: "cosmos",
      network: "quicksilver",
    },
    persistence: {
      currencyId: "persistence",
      family: "cosmos",
      network: "persistence",
    },
    dydx: {
      currencyId: "dydx",
      family: "cosmos",
      network: "dydx",
    },
    injective: {
      currencyId: "injective",
      family: "cosmos",
      network: "injective",
    },
    sei: {
      currencyId: "sei",
      family: "cosmos",
      network: "sei",
    },
    mantra: {
      currencyId: "mantra",
      family: "cosmos",
      network: "mantra",
    },
  },
} as const satisfies SupportedLedgerFamiliesWithCurrency;

export const ledgerChainPriority = new Map<WalletNetwork, number>([
  ["polkadot", 1],
  ["avalanche-c", 2],
  ["tron", 3],
  ["binance", 4],
  ["cronos", 5],
  ["polygon", 6],
]);

export type SupportedLedgerFamiliesWithCurrency = Record<
  SupportedLedgerLiveFamilies,
  Record<
    Currency["id"],
    {
      family: SupportedLedgerLiveFamilies;
      currencyId: Currency["id"];
      network: WalletNetwork;
    }
  >
>;
