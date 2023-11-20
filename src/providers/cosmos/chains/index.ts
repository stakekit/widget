import { CosmosNetworks } from "@stakekit/common";
import { SupportedCosmosChains } from "../../../domain/types/chains";
import { getNetworkLogo, getTokenLogo } from "../../../utils";
import { mainnet } from "wagmi";
import { cosmosRegistryChains } from "./chain-registry";

// CosmosNetworks -> chain_id from registry
export const sKCosmosNetworksToRegistryIds: {
  [Key in SupportedCosmosChains]: string;
} = {
  [CosmosNetworks.Cosmos]: "cosmoshub-4",
  [CosmosNetworks.Akash]: "akashnet-2",
  [CosmosNetworks.Osmosis]: "osmosis-1",
  [CosmosNetworks.Juno]: "juno-1",
  [CosmosNetworks.Kava]: "kava_2222-10",
  [CosmosNetworks.Stargaze]: "stargaze-1",
  [CosmosNetworks.Agoric]: "agoric-3",
  [CosmosNetworks.Regen]: "regen-1",
  [CosmosNetworks.Axelar]: "axelar-dojo-1",
  [CosmosNetworks.BandProtocol]: "laozi-mainnet",
  [CosmosNetworks.Chihuahua]: "chihuahua-1",
  [CosmosNetworks.Comdex]: "comdex-1",
  [CosmosNetworks.Crescent]: "crescent-1",
  [CosmosNetworks.Cronos]: "crypto-org-chain-mainnet-1",
  [CosmosNetworks.Cudos]: "cudos-1",
  [CosmosNetworks.FetchAi]: "fetchhub-4",
  [CosmosNetworks.GravityBridge]: "gravity-bridge-3",
  [CosmosNetworks.IRISnet]: "irishub-1",
  [CosmosNetworks.KiNetwork]: "kichain-2",
  [CosmosNetworks.MarsProtocol]: "mars-1",
  [CosmosNetworks.Onomy]: "onomy-mainnet-1",
  [CosmosNetworks.Quicksilver]: "quicksilver-2",
  [CosmosNetworks.Secret]: "secret-4",
  [CosmosNetworks.Sentinel]: "sentinelhub-2",
  [CosmosNetworks.Sommelier]: "sommelier-3",
  [CosmosNetworks.Teritori]: "teritori-1",
  [CosmosNetworks.Umee]: "umee-1",
  [CosmosNetworks.Persistence]: "core-1",
  [CosmosNetworks.Bitsong]: "bitsong-2b",
  [CosmosNetworks.Coreum]: "coreum-mainnet-1",
  [CosmosNetworks.Desmos]: "desmos-mainnet",
};

// chain_id from registry -> CosmosNetworks
const registryIdsToSKCosmosNetworks: Record<string, CosmosNetworks> =
  Object.fromEntries(
    Object.keys(sKCosmosNetworksToRegistryIds).map((key) => [
      sKCosmosNetworksToRegistryIds[key as SupportedCosmosChains],
      key as SupportedCosmosChains,
    ])
  );

export const filteredCosmosChains = Object.fromEntries(
  cosmosRegistryChains.reduce(
    (acc, chain) => {
      if (chain.chain_id in registryIdsToSKCosmosNetworks) {
        acc.push([chain.chain_id, chain]);
      }

      return acc;
    },
    [] as [string, CosmosChainsAssets][]
  )
);

export type CosmosChainsAssets = (typeof cosmosRegistryChains)[number];

export const getWagmiChain = (chain: CosmosChainsAssets) => ({
  id: chain.chain_id as unknown as number,
  iconUrl:
    chain.chain_id === "osmosis-1"
      ? getNetworkLogo(CosmosNetworks.Osmosis)
      : chain.chain_id === "mars-1"
        ? getTokenLogo("mars")
        : chain.logo_URIs?.png ?? chain.logo_URIs?.svg ?? "",

  name: chain.chain_name,
  network: chain.chain_id,
  // TODO: change this
  nativeCurrency: mainnet.nativeCurrency,
  rpcUrls: {
    default: {
      http: chain.apis?.rpc?.map((r) => r.address) ?? [""],
    },
    public: {
      http: chain.apis?.rpc?.map((r) => r.address) ?? [""],
    },
  },
});
