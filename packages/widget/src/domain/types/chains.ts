import type { Currency, Families } from "@ledgerhq/wallet-api-client";
import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";
import type { CosmosChainsAssets } from "../../providers/cosmos/chains";

export const supportedCosmosChains = [
  CosmosNetworks.Akash,
  CosmosNetworks.Cosmos,
  CosmosNetworks.Juno,
  CosmosNetworks.Kava,
  CosmosNetworks.Osmosis,
  CosmosNetworks.Stargaze,
  CosmosNetworks.Onomy,
  CosmosNetworks.Persistence,
  CosmosNetworks.Axelar,
  CosmosNetworks.Quicksilver,
  CosmosNetworks.Agoric,
  CosmosNetworks.BandProtocol,
  CosmosNetworks.Bitsong,
  CosmosNetworks.Chihuahua,
  CosmosNetworks.Comdex,
  CosmosNetworks.Crescent,
  CosmosNetworks.Cronos,
  CosmosNetworks.Cudos,
  CosmosNetworks.FetchAi,
  CosmosNetworks.GravityBridge,
  CosmosNetworks.IRISnet,
  CosmosNetworks.KiNetwork,
  CosmosNetworks.MarsProtocol,
  CosmosNetworks.Regen,
  CosmosNetworks.Secret,
  CosmosNetworks.Sentinel,
  CosmosNetworks.Sommelier,
  CosmosNetworks.Teritori,
  CosmosNetworks.Umee,
  CosmosNetworks.Coreum,
  CosmosNetworks.Desmos,
  CosmosNetworks.Dydx,
  CosmosNetworks.Injective,
] as const;
export type SupportedCosmosChains = (typeof supportedCosmosChains)[number];
const supportedCosmosChainsSet = new Set(supportedCosmosChains);
export type CosmosChainsMap = {
  [Key in SupportedCosmosChains]: {
    type: "cosmos";
    skChainName: Key;
    wagmiChain: Chain;
    chain: CosmosChainsAssets;
  };
};

const supportedEVMChains = [
  EvmNetworks.AvalancheC,
  EvmNetworks.Arbitrum,
  EvmNetworks.Binance,
  EvmNetworks.Celo,
  EvmNetworks.Ethereum,
  EvmNetworks.EthereumGoerli,
  EvmNetworks.Harmony,
  EvmNetworks.Optimism,
  EvmNetworks.Polygon,
  EvmNetworks.Viction,
  EvmNetworks.EthereumHolesky,
  EvmNetworks.Base,
  EvmNetworks.Linea,
] as const;
const supportedEVMChainsSet = new Set(supportedEVMChains);
type SupportedEvmChain = (typeof supportedEVMChains)[number];
export type EvmChainsMap = {
  [Key in SupportedEvmChain]: {
    type: "evm";
    skChainName: Key;
    wagmiChain: Chain;
  };
};

const supportedMiscChains = [
  MiscNetworks.Near,
  MiscNetworks.Tezos,
  MiscNetworks.Solana,
  MiscNetworks.Tron,
] as const;
const supportedMiscChainsSet = new Set(supportedMiscChains);
type SupportedMiscChains = (typeof supportedMiscChains)[number];
export type MiscChainsMap = {
  [Key in SupportedMiscChains]: {
    type: "misc";
    skChainName: Key;
    wagmiChain: Chain;
  };
};

const supportedSubstrateChains = [SubstrateNetworks.Polkadot] as const;
const supportedSubstrateChainsSet = new Set(supportedSubstrateChains);
type SupportedSubstrateChains = (typeof supportedSubstrateChains)[number];
export type SubstrateChainsMap = {
  [Key in SupportedSubstrateChains]: {
    type: "substrate";
    skChainName: Key;
    wagmiChain: Chain;
  };
};

export const isSupportedChain = (chain: string): chain is SupportedSKChains => {
  return (
    supportedCosmosChainsSet.has(chain as SupportedCosmosChains) ||
    supportedEVMChainsSet.has(chain as SupportedEvmChain) ||
    supportedMiscChainsSet.has(chain as SupportedMiscChains) ||
    supportedSubstrateChainsSet.has(chain as SupportedSubstrateChains)
  );
};

export type SupportedSKChains =
  | SupportedCosmosChains
  | SupportedEvmChain
  | SupportedMiscChains
  | SupportedSubstrateChains;

/**
 * LEDGER LIVE
 */

export type SupportedLedgerLiveFamilies = Extract<
  Families,
  | "ethereum"
  | "near"
  | "tezos"
  | "solana"
  | "cosmos"
  | "crypto_org"
  | "celo"
  | "tron"
  | "polkadot"
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
  polkadot: {
    "*": {
      currencyId: "polkadot",
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
  crypto_org: {
    "*": {
      currencyId: "crypto_org",
      family: "crypto_org",
      skChainName: CosmosNetworks.Cronos,
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
    "avalanche-c": {
      currencyId: "avalanche_c_chain",
      family: "ethereum",
      skChainName: EvmNetworks.AvalancheC,
    },
    ethereum_holesky: {
      currencyId: "ethereum_holesky",
      family: "ethereum",
      skChainName: EvmNetworks.EthereumHolesky,
    },
  },
  cosmos: {
    cosmos: {
      currencyId: "cosmos",
      family: "cosmos",
      skChainName: CosmosNetworks.Cosmos,
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
  },
} as const satisfies SupportedLedgerFamiliesWithCurrency;

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
