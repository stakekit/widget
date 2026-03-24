import { EvmNetworks, MiscNetworks, SubstrateNetworks } from "@stakekit/common";
import type { ChainGroup } from "@stakekit/rainbowkit";
import { getNetworkLogo } from "../../../utils";
import { type SupportedCosmosChains, supportedCosmosChainsSet } from "./cosmos";
import {
  type EvmChainIds,
  type SupportedEvmChain,
  supportedEVMChainsSet,
} from "./evm";
import {
  type MiscChainIds,
  type SupportedMiscChains,
  supportedMiscChainsSet,
} from "./misc";
import {
  type SubstrateChainIds,
  type SupportedSubstrateChains,
  supportedSubstrateChainsSet,
} from "./substrate";

export const isEvmChain = (chain: string): chain is SupportedEvmChain => {
  return supportedEVMChainsSet.has(chain as SupportedEvmChain);
};

export const isSolanaChain = (chain: string): chain is SupportedMiscChains => {
  return chain === MiscNetworks.Solana;
};

export const isTonChain = (chain: string): chain is SupportedMiscChains => {
  return chain === MiscNetworks.Ton;
};

export const isTronChain = (chain: string): chain is SupportedMiscChains => {
  return chain === MiscNetworks.Tron;
};

export const isBittensorChain = (
  chain: string
): chain is SupportedSubstrateChains => {
  return chain === SubstrateNetworks.Bittensor;
};

export const isSupportedChain = (chain: string): chain is SupportedSKChains => {
  return (
    isEvmChain(chain) ||
    supportedCosmosChainsSet.has(chain as SupportedCosmosChains) ||
    supportedMiscChainsSet.has(chain as SupportedMiscChains) ||
    supportedSubstrateChainsSet.has(chain as SupportedSubstrateChains)
  );
};

export const evmChainGroup: ChainGroup = {
  iconUrl: getNetworkLogo(EvmNetworks.Ethereum),
  title: "EVM",
  id: "evm",
};

export type SupportedSKChainIds =
  | EvmChainIds
  | SubstrateChainIds
  | MiscChainIds;

export type SupportedSKChains =
  | SupportedCosmosChains
  | SupportedEvmChain
  | SupportedMiscChains
  | SupportedSubstrateChains;
