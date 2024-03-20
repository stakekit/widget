import { chains, assets } from "chain-registry";
import { AssetList, Chain } from "@chain-registry/types";

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
  "coreum-mainnet-1",
  "desmos-mainnet",
  "dydx-mainnet-1",
  "injective-1",
]);

const chainMapper = <T extends AssetList | Chain>(val: T) => {
  let name = val.chain_name[0].toUpperCase() + val.chain_name.slice(1);

  if ("chain_id" in val) {
    if (val.chain_id === "crypto-org-chain-mainnet-1") {
      name = "Crypto.org Chain";
    } else if (val.chain_id === "laozi-mainnet") {
      name = "Band Chain";
    } else if (val.chain_id === "secret-4") {
      name = "Secret Network";
    } else if (val.chain_id === "fetchhub-4") {
      name = "Fetch.AI";
    } else if (val.chain_id === "kichain-2") {
      name = "Ki Chain";
    } else if (val.chain_id === "irishub-1") {
      name = "IRISnet";
    } else if (val.chain_id === "gravity-bridge-3") {
      name = "Gravity Bridge";
    } else if (val.chain_id === "cosmoshub-4") {
      name = "Cosmos";
    }
  }

  return {
    ...val,
    chain_name: name,
  };
};

const assetMapper = (val: AssetList & Pick<Chain, "chain_id">) => {
  if (val.chain_id === "comdex-1") {
    val.assets[1].coingecko_id = "harbor-2";
  }

  return val;
};

const cosmosRegistryChains: Chain[] = chains
  .filter((c) => chainsSet.has(c.chain_id))
  .map(chainMapper);

export const getCosmosRegistryChains = (): Chain[] => cosmosRegistryChains;

const filteredCosmosChainNames = new Map(
  cosmosRegistryChains.map((c) => [c.chain_name, c.chain_id])
);

const filterMissingChainName = (val: AssetList) => !!val.chain_name;

export const getCosmosAssets = (): (AssetList & Pick<Chain, "chain_id">)[] =>
  assets
    .filter(filterMissingChainName)
    .map(chainMapper)
    .filter((a) => filteredCosmosChainNames.has(a.chain_name))
    .map((val) => {
      const chain_id = filteredCosmosChainNames.get(val.chain_name);

      if (!chain_id) throw new Error("Chain not found");

      return {
        ...val,
        chain_id,
      };
    })
    .map(assetMapper);
