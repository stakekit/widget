import type { CosmosChainsAssets } from "@sk-widget/providers/cosmos/chains/types";
import { CosmosNetworks } from "@stakekit/common";
import type { Chain } from "@stakekit/rainbowkit";

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

export const supportedCosmosChainsSet = new Set(supportedCosmosChains);

export type SupportedCosmosChains = (typeof supportedCosmosChains)[number];

export type CosmosChainsMap = {
  [Key in SupportedCosmosChains]: {
    type: "cosmos";
    skChainName: Key;
    wagmiChain: Chain;
    chain: CosmosChainsAssets;
  };
};
