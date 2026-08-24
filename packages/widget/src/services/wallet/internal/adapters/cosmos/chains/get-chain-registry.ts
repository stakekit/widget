import { assets, chains as RegistryChains } from "chain-registry";
import { Array as EArray, Option } from "effect";
import {
  type WalletCosmosNetwork,
  walletCosmosNetworks,
} from "../../../../../../domain/wallet/network.ts";
import type { CosmosChain, WithWagmiName } from "../chains.ts";

type AssetList = (typeof assets)[number];
type Asset = AssetList["assets"][number];

const mantra: CosmosChain = {
  $schema: "../chain.schema.json",
  chain_name: "mantrachain",
  status: "live",
  network_type: "mainnet",
  pretty_name: "MANTRA",
  chain_type: "cosmos",
  chain_id: "mantra-1",
  bech32_prefix: "mantra",
  daemon_name: "mantrachaind",
  node_home: "$HOME/.mantrachain",
  key_algos: ["secp256k1"],
  slip44: 118,
  fees: {
    fee_tokens: [
      {
        denom: "uom",
        fixed_min_gas_price: 0.01,
        low_gas_price: 0.01,
        average_gas_price: 0.02,
        high_gas_price: 0.03,
      },
    ],
  },
  staking: {
    staking_tokens: [
      {
        denom: "uom",
      },
    ],
  },
  codebase: {
    git_repo: "https://github.com/MANTRA-CosmosChain/mantrachain",
    recommended_version: "1.0.0",
    compatible_versions: ["1.0.0"],
    cosmos_sdk_version: "0.50.10",
    consensus: {
      type: "cometbft",
      version: "0.38",
    },
    versions: [
      {
        name: "1.0.0-rc3",
        recommended_version: "1.0.0-rc3",
        compatible_versions: ["1.0.0-rc3"],
        cosmos_sdk_version: "0.50.10",
        consensus: {
          type: "cometbft",
          version: "0.38",
        },
      },
    ],
  },
  peers: {
    seeds: [
      {
        id: "32276da966637722914411e16ca91bd37dcd1c28",
        address: "35.220.157.87:26656",
      },
      {
        id: "9f5235b418c87af4302619705d0bf4748249ca6b",
        address: "34.18.33.96:26656",
      },
      {
        id: "b0acfd505bb4bc0c39d095663d310c253de18210",
        address: "34.130.121.222:26656",
      },
    ],
  },
  apis: {
    rpc: [
      {
        address: "https://rpc.mantrachain.io",
        provider: "MANTRACHAIN",
      },
    ],
    rest: [
      {
        address: "https://api.mantrachain.io",
        provider: "MANTRACHAIN",
      },
    ],
    grpc: [
      {
        address: "https://grpc.mantrachain.io",
        provider: "MANTRACHAIN",
      },
    ],
  },
  logo_URIs: {
    png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/mantrachain/images/OM-Prim-Col.png",
    svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/mantrachain/images/OM-Prim-Col.svg",
  },
  explorers: [],
  keywords: ["rwa", "wasm", "staking"],
  images: [
    {
      image_sync: {
        chain_name: "mantrachain",
      },
      png: "https://raw.githubusercontent.com/cosmos/chain-registry/master/mantrachain/images/OM-Prim-Col.png",
      svg: "https://raw.githubusercontent.com/cosmos/chain-registry/master/mantrachain/images/OM-Prim-Col.svg",
      theme: {
        circle: false,
        primary_color_hex: "#fba0c1",
      },
    },
  ],
};

const chains: CosmosChain[] = [...RegistryChains, mantra];

// CosmosNetworks -> chain_id from registry
const skCosmosNetworksToRegistryIds: {
  [Key in WalletCosmosNetwork]: CosmosChain["chain_id"];
} = {
  cosmos: "cosmoshub-4",
  akash: "akashnet-2",
  osmosis: "osmosis-1",
  juno: "juno-1",
  kava: "kava_2222-10",
  stargaze: "stargaze-1",
  agoric: "agoric-3",
  regen: "regen-1",
  axelar: "axelar-dojo-1",
  "band-protocol": "laozi-mainnet",
  chihuahua: "chihuahua-1",
  comdex: "comdex-1",
  crescent: "crescent-1",
  cronos: "crypto-org-chain-mainnet-1",
  cudos: "cudos-1",
  "fetch-ai": "fetchhub-4",
  "gravity-bridge": "gravity-bridge-3",
  irisnet: "irishub-1",
  "ki-network": "kichain-2",
  "mars-protocol": "mars-1",
  onomy: "onomy-mainnet-1",
  quicksilver: "quicksilver-2",
  secret: "secret-4",
  sentinel: "sentinelhub-2",
  sommelier: "sommelier-3",
  teritori: "teritori-1",
  umee: "umee-1",
  persistence: "core-1",
  bitsong: "bitsong-2b",
  coreum: "coreum-mainnet-1",
  desmos: "desmos-mainnet",
  dydx: "dydx-mainnet-1",
  injective: "injective-1",
  sei: "pacific-1",
  mantra: "mantra-1",
};

const registryIdsToSKCosmosNetworks: Record<string, WalletCosmosNetwork> =
  Object.fromEntries(
    walletCosmosNetworks.map((key) => [skCosmosNetworksToRegistryIds[key], key])
  );

const registryIdsSet = new Set(Object.values(skCosmosNetworksToRegistryIds));

const chainMapper = <T extends AssetList | CosmosChain>(
  val: T
): WithWagmiName<T> => {
  let wagmiName =
    val.chain_name.charAt(0).toUpperCase() + val.chain_name.slice(1);

  if ("chain_id" in val) {
    if (val.chain_id === "crypto-org-chain-mainnet-1") {
      wagmiName = "Cronos POS Chain";
    } else if (val.chain_id === "laozi-mainnet") {
      wagmiName = "Band CosmosChain";
    } else if (val.chain_id === "secret-4") {
      wagmiName = "Secret Network";
    } else if (val.chain_id === "fetchhub-4") {
      wagmiName = "Fetch.AI";
    } else if (val.chain_id === "kichain-2") {
      wagmiName = "Ki CosmosChain";
    } else if (val.chain_id === "irishub-1") {
      wagmiName = "IRISnet";
    } else if (val.chain_id === "gravity-bridge-3") {
      wagmiName = "Gravity Bridge";
    } else if (val.chain_id === "cosmoshub-4") {
      wagmiName = "Cosmos";
    } else if (val.chain_id === "mantra-1") {
      wagmiName = "Mantra";
    }
  }

  return { ...val, wagmiName };
};

const assetMapper = (
  val: WithWagmiName<AssetList & Pick<CosmosChain, "chain_id">>
) => {
  if (val.chain_id === "comdex-1") {
    const harborAsset = EArray.get(val.assets, 1).pipe(Option.getOrUndefined);

    if (harborAsset) harborAsset.coingecko_id = "harbor-2";
  }

  return val;
};

const pickGasPrices = (
  feeToken: NonNullable<CosmosChain["fees"]>["fee_tokens"][number]
) => ({
  denom: feeToken.denom,
  low_gas_price: feeToken.low_gas_price,
  average_gas_price: feeToken.average_gas_price,
  high_gas_price: feeToken.high_gas_price,
});

const trimChain = (
  chain: WithWagmiName<CosmosChain>
): WithWagmiName<CosmosChain> =>
  ({
    chain_name: chain.chain_name,
    pretty_name: chain.pretty_name,
    chain_id: chain.chain_id,
    bech32_prefix: chain.bech32_prefix,
    slip44: chain.slip44,
    fees: chain.fees
      ? {
          fee_tokens: chain.fees.fee_tokens.map(pickGasPrices),
        }
      : undefined,
    staking: chain.staking
      ? {
          staking_tokens: chain.staking.staking_tokens.map((stakingToken) => ({
            denom: stakingToken.denom,
          })),
        }
      : undefined,
    apis: {
      rpc: chain.apis?.rpc?.map(({ address }) => ({ address })),
      rest: chain.apis?.rest?.map(({ address }) => ({ address })),
    },
    codebase: chain.codebase
      ? {
          cosmos_sdk_version: chain.codebase.cosmos_sdk_version,
          cosmwasm_enabled: chain.codebase.cosmwasm_enabled,
          cosmwasm_version: chain.codebase.cosmwasm_version,
          sdk: chain.codebase.sdk,
          cosmwasm: chain.codebase.cosmwasm,
        }
      : undefined,
    logo_URIs: chain.logo_URIs,
    explorers: chain.explorers?.map(({ url }) => ({ url })),
    wagmiName: chain.wagmiName,
  }) as WithWagmiName<CosmosChain>;

const trimAsset = (asset: Asset): Asset =>
  ({
    base: asset.base,
    name: asset.name,
    display: asset.display,
    symbol: asset.symbol,
    denom_units: asset.denom_units.map(({ denom, exponent }) => ({
      denom,
      exponent,
    })),
    logo_URIs: asset.logo_URIs,
    coingecko_id: asset.coingecko_id,
    type_asset: asset.type_asset,
  }) as Asset;

const trimAssetList = (
  assetList: WithWagmiName<AssetList & Pick<CosmosChain, "chain_id">>
): WithWagmiName<AssetList & Pick<CosmosChain, "chain_id">> =>
  ({
    chain_name: assetList.chain_name,
    assets: assetList.assets.map(trimAsset),
    wagmiName: assetList.wagmiName,
    chain_id: assetList.chain_id,
  }) as WithWagmiName<AssetList & Pick<CosmosChain, "chain_id">>;

const cosmosRegistryChains: WithWagmiName<CosmosChain>[] = chains
  .filter((c) => registryIdsSet.has(c.chain_id))
  .map(chainMapper)
  .map(trimChain)
  .sort((a, b) => a.wagmiName.localeCompare(b.wagmiName));

export const getCosmosRegistryChains = (): WithWagmiName<CosmosChain>[] =>
  cosmosRegistryChains;

export const getRegistryIdsToSKCosmosNetworks =
  (): typeof registryIdsToSKCosmosNetworks => registryIdsToSKCosmosNetworks;

const filteredCosmosChainNames = new Map(
  cosmosRegistryChains.map((c) => [c.chain_name, c.chain_id])
);

const filterMissingChainName = (val: AssetList) => !!val.chain_name;

export const getCosmosAssets = (): WithWagmiName<
  AssetList & Pick<CosmosChain, "chain_id">
>[] =>
  assets
    .filter(filterMissingChainName)
    .map(chainMapper)
    .filter((a) => filteredCosmosChainNames.has(a.chain_name))
    .map((val) => {
      const chain_id = filteredCosmosChainNames.get(val.chain_name);

      if (!chain_id) throw new Error("CosmosChain not found");

      return {
        ...val,
        chain_id,
      };
    })
    .map(assetMapper)
    .map(trimAssetList);
