import type { Chain, AssetList } from "./get-chain-registry";
import {
  getCosmosAssets,
  getCosmosRegistryChains,
  getRegistryIdsToSKCosmosNetworks,
} from "./get-chain-registry" with { type: "macro" };

export type { Chain, AssetList };

export const cosmosAssets: ReturnType<typeof getCosmosAssets> =
  getCosmosAssets();

export const cosmosRegistryChains: ReturnType<typeof getCosmosRegistryChains> =
  getCosmosRegistryChains();

export const registryIdsToSKCosmosNetworks: ReturnType<
  typeof getRegistryIdsToSKCosmosNetworks
> = getRegistryIdsToSKCosmosNetworks();
