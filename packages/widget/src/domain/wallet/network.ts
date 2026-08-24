import { Schema } from "effect";
import type { Network } from "../network/network";

export const walletEvmNetworks = [
  "avalanche-c",
  "arbitrum",
  "binance",
  "celo",
  "ethereum",
  "ethereum-goerli",
  "harmony",
  "optimism",
  "polygon",
  "viction",
  "ethereum-hoodi",
  "base",
  "linea",
  "core",
  "sonic",
  "ethereum-sepolia",
  "unichain",
  "katana",
  "gnosis",
  "hyperevm",
  "plasma",
  "monad",
  "monad-testnet",
  "pharos",
] as const satisfies ReadonlyArray<Network>;

export type WalletEvmNetwork = (typeof walletEvmNetworks)[number];

export const walletCosmosNetworks = [
  "akash",
  "cosmos",
  "juno",
  "kava",
  "osmosis",
  "stargaze",
  "onomy",
  "persistence",
  "axelar",
  "quicksilver",
  "agoric",
  "band-protocol",
  "bitsong",
  "chihuahua",
  "comdex",
  "crescent",
  "cronos",
  "cudos",
  "fetch-ai",
  "gravity-bridge",
  "irisnet",
  "ki-network",
  "mars-protocol",
  "regen",
  "secret",
  "sentinel",
  "sommelier",
  "teritori",
  "umee",
  "coreum",
  "desmos",
  "dydx",
  "injective",
  "sei",
  "mantra",
] as const satisfies ReadonlyArray<Network>;

export type WalletCosmosNetwork = (typeof walletCosmosNetworks)[number];

export const walletMiscNetworks = [
  "near",
  "tezos",
  "solana",
  "tron",
  "ton",
  "cardano",
] as const satisfies ReadonlyArray<Network>;

export type WalletMiscNetwork = (typeof walletMiscNetworks)[number];

export const walletSubstrateNetworks = [
  "polkadot",
  "bittensor",
] as const satisfies ReadonlyArray<Network>;

export type WalletSubstrateNetwork = (typeof walletSubstrateNetworks)[number];

export const walletNetworks = [
  ...walletEvmNetworks,
  ...walletCosmosNetworks,
  ...walletMiscNetworks,
  ...walletSubstrateNetworks,
] as const;

export const WalletNetwork = Schema.Literals(walletNetworks);
export type WalletNetwork = typeof WalletNetwork.Type;

const walletEvmNetworkSet = new Set<string>(walletEvmNetworks);
const walletCosmosNetworkSet = new Set<string>(walletCosmosNetworks);

export const isEvmWalletNetwork = (
  network: string
): network is WalletEvmNetwork => walletEvmNetworkSet.has(network);

export const isCosmosWalletNetwork = (
  network: string
): network is WalletCosmosNetwork => walletCosmosNetworkSet.has(network);

export const isWalletNetwork = Schema.is(WalletNetwork);
