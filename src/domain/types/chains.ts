import { Chain } from "@stakekit/rainbowkit";
import {
  CosmosNetworks,
  EvmNetworks,
  MiscNetworks,
  Networks,
} from "@stakekit/common";
import { CosmosChainsAssets } from "../../providers/cosmos/chains";
import { Currency, Families } from "@ledgerhq/wallet-api-client";

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
] as const;
export type SupportedCosmosChains = (typeof supportedCosmosChains)[number];
export const supportedCosmosChainsSet = new Set(supportedCosmosChains);
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
  EvmNetworks.Celo,
  EvmNetworks.Ethereum,
  EvmNetworks.EthereumGoerli,
  EvmNetworks.Harmony,
  EvmNetworks.Optimism,
  EvmNetworks.Polygon,
] as const;
export const supportedEVMChainsSet = new Set(supportedEVMChains);
export type SupportedEvmChain = (typeof supportedEVMChains)[number];
export type EvmChainsMap = {
  [Key in SupportedEvmChain]: {
    type: "evm";
    skChainName: Key;
    wagmiChain: Chain;
  };
};

export const supportedMiscChains = [
  MiscNetworks.Near,
  MiscNetworks.Tezos,
  MiscNetworks.Solana,
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

export const isSupportedChain = (
  chain: string
): chain is SupportedEvmChain | SupportedCosmosChains | SupportedMiscChains => {
  return (
    supportedCosmosChainsSet.has(chain as SupportedCosmosChains) ||
    supportedEVMChainsSet.has(chain as SupportedEvmChain) ||
    supportedMiscChainsSet.has(chain as SupportedMiscChains)
  );
};

export type SupportedSKChains =
  | SupportedCosmosChains
  | SupportedEvmChain
  | SupportedMiscChains;

/**
 * LEDGER LIVE
 */

export type SupportedLedgerLiveFamilies = Extract<
  Families,
  "ethereum" | "near" | "tezos" | "solana" | "cosmos" | "crypto_org" | "celo"
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
  },
} satisfies Record<
  SupportedLedgerLiveFamilies,
  Record<
    Currency["id"],
    {
      family: SupportedLedgerLiveFamilies;
      currencyId: Currency["id"];
      skChainName: Networks;
    }
  >
>;

export type SupportedLedgerFamiliesWithCurrency =
  typeof supportedLedgerFamiliesWithCurrency;
