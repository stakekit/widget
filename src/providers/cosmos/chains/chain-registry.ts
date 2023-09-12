import preval from "babel-plugin-preval/macro";
import { AssetList, Chain } from "@chain-registry/types";

export const { cosmosRegistryChains, cosmosAssets } = preval`
  const { chains, assets } = require("chain-registry");

  const chainsSet = new Set([
    "cosmoshub-4",
    "akashnet-2",
    "osmosis-1",
    "juno-1",
    "kava_2222-10",
    "stargaze-1",
    "agoric-3",
    "regen-1",
    "axelar-dojo-1",
    "laozi-mainnet",
    "chihuahua-1",
    "comdex-1",
    "crescent-1",
    "crypto-org-chain-mainnet-1",
    "cudos-1",
    "fetchhub-4",
    "gravity-bridge-3",
    "irishub-1",
    "kichain-2",
    "mars-1",
    "onomy-mainnet-1",
    "quicksilver-2",
    "secret-4",
    "sentinelhub-2",
    "sommelier-3",
    "teritori-1",
    "umee-1",
    "core-1",
    "bitsong-2b",
  ]);

  const cosmosRegistryChains = chains.filter((c) => chainsSet.has(c.chain_id));

  const filteredCosmosChainNames = new Set(
    cosmosRegistryChains.map((c) => c.chain_name)
  );

  const cosmosAssets = assets.filter((a) => {
    // Patch comdex assets coingecko id
    if (a.chain_name === "comdex") {
      a.assets[1].coingecko_id = "harbor-2";
    }

    return filteredCosmosChainNames.has(a.chain_name);
  });

  module.exports = {
    cosmosRegistryChains,
    cosmosAssets,
  };
` as { cosmosRegistryChains: Chain[]; cosmosAssets: AssetList[] };
