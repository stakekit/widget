import type { chains } from "chain-registry";
import type { WalletCosmosNetwork } from "../../../../../domain/wallet/network";
import type { Chain } from "../../../wallet-descriptors";

export type CosmosChain = (typeof chains)[number];
export type WithWagmiName<T> = T & { readonly wagmiName: string };
export type CosmosChainsAssets = WithWagmiName<CosmosChain>;

export type CosmosChainEntry<Key extends WalletCosmosNetwork> = {
  type: "cosmos";
  network: Key;
  wagmiChain: Chain;
  chain: CosmosChainsAssets;
};

export type CosmosChainsMap = {
  [Key in WalletCosmosNetwork]: CosmosChainEntry<Key>;
};
