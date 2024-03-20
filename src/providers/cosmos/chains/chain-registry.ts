import {
  getCosmosAssets,
  getCosmosRegistryChains,
} from "./get-chain-registry" with { type: "macro" };

export const cosmosAssets = getCosmosAssets();
export const cosmosRegistryChains = getCosmosRegistryChains();
