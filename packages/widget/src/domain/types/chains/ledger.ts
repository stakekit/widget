import type { Currency, Families } from "@ledgerhq/wallet-api-client";
import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "@stakekit/common";
import type { SupportedSKChains } from "./";

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
      skChainName: MiscNetworks.Near,
    },
  },
  tezos: {
    "*": {
      currencyId: "tezos",
      family: "tezos",
      skChainName: MiscNetworks.Tezos,
    },
  },
  solana: {
    "*": {
      currencyId: "solana",
      family: "solana",
      skChainName: MiscNetworks.Solana,
    },
  },
  tron: {
    "*": {
      currencyId: "tron",
      family: "tron",
      skChainName: MiscNetworks.Tron,
    },
  },
  ton: {
    "*": {
      currencyId: "ton",
      family: "ton",
      skChainName: MiscNetworks.Ton,
    },
  },
  polkadot: {
    "*": {
      currencyId: "assethub_polkadot",
      family: "polkadot",
      skChainName: SubstrateNetworks.Polkadot,
    },
  },
  celo: {
    "*": {
      currencyId: "celo",
      family: "celo",
      skChainName: EvmNetworks.Celo,
    },
  },
  ethereum: {
    ethereum: {
      currencyId: "ethereum",
      family: "ethereum",
      skChainName: EvmNetworks.Ethereum,
    },
    polygon: {
      currencyId: "polygon",
      family: "ethereum",
      skChainName: EvmNetworks.Polygon,
    },
    arbitrum: {
      currencyId: "arbitrum",
      family: "ethereum",
      skChainName: EvmNetworks.Arbitrum,
    },
    optimism: {
      currencyId: "optimism",
      family: "ethereum",
      skChainName: EvmNetworks.Optimism,
    },
    avalanche_c_chain: {
      currencyId: "avalanche_c_chain",
      family: "ethereum",
      skChainName: EvmNetworks.AvalancheC,
    },
    ethereum_hoodi: {
      currencyId: "ethereum_hoodi",
      family: "ethereum",
      skChainName: EvmNetworks.EthereumHoodi,
    },
    bsc: {
      currencyId: "bsc",
      family: "ethereum",
      skChainName: EvmNetworks.Binance,
    },
  },
  cosmos: {
    cosmos: {
      currencyId: "cosmos",
      family: "cosmos",
      skChainName: CosmosNetworks.Cosmos,
    },
    crypto_org: {
      currencyId: "crypto_org",
      family: "cosmos",
      skChainName: CosmosNetworks.Cronos,
    },
    osmo: {
      currencyId: "osmo",
      family: "cosmos",
      skChainName: CosmosNetworks.Osmosis,
    },
    coreum: {
      currencyId: "coreum",
      family: "cosmos",
      skChainName: CosmosNetworks.Coreum,
    },
    axelar: {
      currencyId: "axelar",
      family: "cosmos",
      skChainName: CosmosNetworks.Axelar,
    },
    stargaze: {
      currencyId: "stargaze",
      family: "cosmos",
      skChainName: CosmosNetworks.Stargaze,
    },
    secret_network: {
      currencyId: "secret_network",
      family: "cosmos",
      skChainName: CosmosNetworks.Secret,
    },
    umee: {
      currencyId: "umee",
      family: "cosmos",
      skChainName: CosmosNetworks.Umee,
    },
    desmos: {
      currencyId: "desmos",
      family: "cosmos",
      skChainName: CosmosNetworks.Desmos,
    },
    onomy: {
      currencyId: "onomy",
      family: "cosmos",
      skChainName: CosmosNetworks.Onomy,
    },
    quicksilver: {
      currencyId: "quicksilver",
      family: "cosmos",
      skChainName: CosmosNetworks.Quicksilver,
    },
    persistence: {
      currencyId: "persistence",
      family: "cosmos",
      skChainName: CosmosNetworks.Persistence,
    },
    dydx: {
      currencyId: "dydx",
      family: "cosmos",
      skChainName: CosmosNetworks.Dydx,
    },
    injective: {
      currencyId: "injective",
      family: "cosmos",
      skChainName: CosmosNetworks.Injective,
    },
    sei: {
      currencyId: "sei",
      family: "cosmos",
      skChainName: CosmosNetworks.Sei,
    },
    mantra: {
      currencyId: "mantra",
      family: "cosmos",
      skChainName: CosmosNetworks.Mantra,
    },
  },
} as const satisfies SupportedLedgerFamiliesWithCurrency;

export const ledgerChainPriority = new Map<SupportedSKChains, number>([
  [SubstrateNetworks.Polkadot, 1],
  [EvmNetworks.AvalancheC, 2],
  [MiscNetworks.Tron, 3],
  [EvmNetworks.Binance, 4],
  [CosmosNetworks.Cronos, 5],
  [EvmNetworks.Polygon, 6],
]);

export type SupportedLedgerFamiliesWithCurrency = Record<
  SupportedLedgerLiveFamilies,
  Record<
    Currency["id"],
    {
      family: SupportedLedgerLiveFamilies;
      currencyId: Currency["id"];
      skChainName: SupportedSKChains;
    }
  >
>;
