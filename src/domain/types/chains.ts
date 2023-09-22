import { Chain } from "@stakekit/rainbowkit";
import { CosmosNetworks, EvmNetworks, MiscNetworks } from "@stakekit/common";
import { CosmosChainsAssets } from "../../providers/cosmos/chains";
import { Families } from "@ledgerhq/wallet-api-client";

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
const supportedEVMChainsSet = new Set(supportedEVMChains);
type SupportedEvmChain = (typeof supportedEVMChains)[number];
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
): chain is SupportedEvmChain | SupportedCosmosChains => {
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

export type SupportedLedgerLiveFamilies =
  | Extract<Families, "ethereum" | "near" | "tezos">
  | SupportedCosmosChains;

export type SupportedLedgerLiveFamiliesMap = {
  [Key in SupportedLedgerLiveFamilies]: {
    currencyFamily: SupportedLedgerLiveFamilies;
    chain: Chain;
  };
};
