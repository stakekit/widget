import type { Chain } from "@stakekit/rainbowkit";
import type { chains } from "chain-registry";
import type { WalletCosmosNetwork } from "../../../../../domain/wallet/network";

export type CosmosChain = (typeof chains)[number];
export type WithWagmiName<T> = T & { readonly wagmiName: string };
export type CosmosChainsAssets = WithWagmiName<CosmosChain>;

export type CosmosChainsMap = {
  [Key in WalletCosmosNetwork]: {
    type: "cosmos";
    network: Key;
    wagmiChain: Chain;
    chain: CosmosChainsAssets;
  };
};
