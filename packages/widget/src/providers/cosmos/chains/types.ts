import type { chains } from "chain-registry";

export type CosmosChain = (typeof chains)[number];

export type WithWagmiName<T> = T & { wagmiName: string };

export type CosmosChainsAssets = WithWagmiName<CosmosChain>;
