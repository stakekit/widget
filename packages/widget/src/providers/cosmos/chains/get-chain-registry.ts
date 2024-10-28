import { CosmosNetworks } from "@stakekit/common";
import { assets, chains } from "chain-registry";
import {
  type SupportedCosmosChains,
  supportedCosmosChains,
} from "../../../domain/types/chains";
import type { WithWagmiName } from "../types";

type AssetList = (typeof assets)[number];
export type Chain = (typeof chains)[number];

// CosmosNetworks -> chain_id from registry
const skCosmosNetworksToRegistryIds: {
  [Key in SupportedCosmosChains]: Chain["chain_id"];
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
  [CosmosNetworks.Dydx]: "dydx-mainnet-1",
  [CosmosNetworks.Injective]: "injective-1",
  [CosmosNetworks.Sei]: "pacific-1",
  [CosmosNetworks.Mantra]: "mantra-1",
};

const registryIdsToSKCosmosNetworks: Record<string, SupportedCosmosChains> =
  Object.fromEntries(
    supportedCosmosChains.map((key) => [
      skCosmosNetworksToRegistryIds[key],
      key,
    ])
  );

const registryIdsSet = new Set(Object.values(skCosmosNetworksToRegistryIds));

const chainMapper = <T extends AssetList | Chain>(val: T): WithWagmiName<T> => {
  let wagmiName = val.chain_name[0].toUpperCase() + val.chain_name.slice(1);

  if ("chain_id" in val) {
    if (val.chain_id === "crypto-org-chain-mainnet-1") {
      wagmiName = "Crypto.org Chain";
    } else if (val.chain_id === "laozi-mainnet") {
      wagmiName = "Band Chain";
    } else if (val.chain_id === "secret-4") {
      wagmiName = "Secret Network";
    } else if (val.chain_id === "fetchhub-4") {
      wagmiName = "Fetch.AI";
    } else if (val.chain_id === "kichain-2") {
      wagmiName = "Ki Chain";
    } else if (val.chain_id === "irishub-1") {
      wagmiName = "IRISnet";
    } else if (val.chain_id === "gravity-bridge-3") {
      wagmiName = "Gravity Bridge";
    } else if (val.chain_id === "cosmoshub-4") {
      wagmiName = "Cosmos";
    }
  }

  return { ...val, wagmiName };
};

const assetMapper = (
  val: WithWagmiName<AssetList & Pick<Chain, "chain_id">>
) => {
  if (val.chain_id === "comdex-1") {
    val.assets[1].coingecko_id = "harbor-2";
  }

  return val;
};

const cosmosRegistryChains: WithWagmiName<Chain>[] = chains
  .filter((c) => registryIdsSet.has(c.chain_id))
  .map(chainMapper);

export const getCosmosRegistryChains = (): WithWagmiName<Chain>[] =>
  cosmosRegistryChains;

export const getRegistryIdsToSKCosmosNetworks =
  (): typeof registryIdsToSKCosmosNetworks => registryIdsToSKCosmosNetworks;

const filteredCosmosChainNames = new Map(
  cosmosRegistryChains.map((c) => [c.chain_name, c.chain_id])
);

const filterMissingChainName = (val: AssetList) => !!val.chain_name;

export const getCosmosAssets = (): WithWagmiName<
  AssetList & Pick<Chain, "chain_id">
>[] =>
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
