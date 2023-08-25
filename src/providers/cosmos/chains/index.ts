import { chains as cosmosRegistryChains } from "chain-registry";
import { CosmosNetworks } from "@stakekit/common";
import { CosmosChainsMap } from "../../../domain/types/chains";
import { getNetworkLogo } from "../../../utils";
import { mainnet } from "wagmi";

// CosmosNetworks -> chain_id from registry
const sKCosmosNetworksToRegistryIds: { [Key in CosmosNetworks]: string } = {
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
  [CosmosNetworks.Canto]: "canto_7700-1",
  [CosmosNetworks.Chihuahua]: "chihuahua-1",
  [CosmosNetworks.Comdex]: "comdex-1",
  [CosmosNetworks.Crescent]: "crescent-1",
  [CosmosNetworks.Cronos]: "cronosmainnet_25-1",
  [CosmosNetworks.Cudos]: "cudos-1",
  [CosmosNetworks.Evmos]: "evmos_9001-2",
  [CosmosNetworks.FetchAi]: "fetchhub-4",
  [CosmosNetworks.GravityBridge]: "gravity-bridge-3",
  [CosmosNetworks.IRISnet]: "irishub-1",
  [CosmosNetworks.Injective]: "injective-1",
  [CosmosNetworks.KiNetwork]: "kichain-2",
  [CosmosNetworks.MarsProtocol]: "mars-1",
  [CosmosNetworks.NYM]: "nyx",
  [CosmosNetworks.OKExChain]: "exchain-66",
  [CosmosNetworks.Onomy]: "onomy-mainnet-1",
  [CosmosNetworks.Quicksilver]: "quicksilver-2",
  [CosmosNetworks.Secret]: "secret-4",
  [CosmosNetworks.Sentinel]: "sentinelhub-2",
  [CosmosNetworks.Sommelier]: "sommelier-3",
  [CosmosNetworks.StaFi]: "stafihub-1",
  [CosmosNetworks.Stride]: "stride-1",
  [CosmosNetworks.TGrade]: "tgrade-mainnet-1",
  [CosmosNetworks.Teritori]: "teritori-1",
  [CosmosNetworks.Umee]: "umee-1",
  [CosmosNetworks.Persistence]: "core-1",
  [CosmosNetworks.Bitsong]: "bitsong-2b",
};

// chain_id from registry -> CosmosNetworks
const registryIdsToSKCosmosNetworks: Record<string, CosmosNetworks> =
  Object.fromEntries(
    Object.keys(sKCosmosNetworksToRegistryIds).map((key) => [
      sKCosmosNetworksToRegistryIds[key as CosmosNetworks],
      key as CosmosNetworks,
    ])
  );

const filteredChains = Object.fromEntries(
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

export const filteredCosmosChainNames = new Set(
  Object.keys(filteredChains).map((key) => filteredChains[key].chain_name)
);

export type CosmosChainsAssets = (typeof cosmosRegistryChains)[number];

const getWagmiChain = (chain: CosmosChainsAssets) => ({
  id: chain.chain_id as unknown as number,
  iconUrl:
    chain.chain_name === CosmosNetworks.Osmosis
      ? getNetworkLogo(CosmosNetworks.Osmosis)
      : chain.logo_URIs?.png ?? chain.logo_URIs?.svg ?? "",
  name: chain.chain_name[0].toUpperCase() + chain.chain_name.slice(1),
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

export const cosmosChainsMap: CosmosChainsMap = Object.values(
  CosmosNetworks
).reduce((acc, next) => {
  const chain = filteredChains[sKCosmosNetworksToRegistryIds[next]];

  if (!chain) throw new Error("Chain not found");

  return {
    ...acc,
    [next]: {
      type: "cosmos",
      skChainName: next,
      chain,
      wagmiChain: getWagmiChain(chain),
    },
  };
}, {} as CosmosChainsMap);
