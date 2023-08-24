import { Chain } from "@rainbow-me/rainbowkit";
import { CosmosNetworks, EvmNetworks } from "@stakekit/common";
import { CosmosChainsAssets } from "../../providers/cosmos/chains";

type SupportedCosmosChains = CosmosNetworks;

export type CosmosChainsMap = {
  [Key in SupportedCosmosChains]: {
    type: "cosmos";
    skChainName: Key;
    wagmiChain: Chain;
    chain: CosmosChainsAssets;
  };
};

type SupportedEvmChain = Exclude<
  EvmNetworks,
  "binance" | "phantom" | "avalanche-p" | "avalanche-c-atomic" | "fantom"
>;

export type EvmChainsMap = {
  [Key in SupportedEvmChain]: {
    type: "evm";
    skChainName: Key;
    wagmiChain: Chain;
  };
};
