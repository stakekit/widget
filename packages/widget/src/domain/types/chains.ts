import type { Currency, Families } from "@ledgerhq/wallet-api-client";
import type { CosmosChainsAssets } from "@sk-widget/providers/cosmos/chains/types";
import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";
import type { Chain as ChainRainbowKit } from "@stakekit/rainbowkit";

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
  CosmosNetworks.Sei,
  CosmosNetworks.Mantra,
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
  EvmNetworks.Core,
  EvmNetworks.Sonic,
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
  MiscNetworks.Ton,
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

export const isEvmChain = (chain: string): chain is SupportedEvmChain => {
  return supportedEVMChainsSet.has(chain as SupportedEvmChain);
};

export const isSolanaChain = (chain: string): chain is SupportedMiscChains => {
  return chain === MiscNetworks.Solana;
};

export const isTonChain = (chain: string): chain is SupportedMiscChains => {
  return chain === MiscNetworks.Ton;
};

export const isSupportedChain = (chain: string): chain is SupportedSKChains => {
  return (
    isEvmChain(chain) ||
    supportedCosmosChainsSet.has(chain as SupportedCosmosChains) ||
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
    ethereum_holesky: {
      currencyId: "ethereum_holesky",
      family: "ethereum",
      skChainName: EvmNetworks.EthereumHolesky,
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

export type SupportedSKChainsType = {
  chainName: SupportedSKChains;
  chainIcon?: ChainRainbowKit["iconUrl"];
};
