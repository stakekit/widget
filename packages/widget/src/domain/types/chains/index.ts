import {
  type SupportedCosmosChains,
  supportedCosmosChainsSet,
} from "@sk-widget/domain/types/chains/cosmos";
import {
  type EvmChainIds,
  type SupportedEvmChain,
  supportedEVMChainsSet,
} from "@sk-widget/domain/types/chains/evm";
import {
  type MiscChainIds,
  type SupportedMiscChains,
  supportedMiscChainsSet,
} from "@sk-widget/domain/types/chains/misc";
import {
  type SubstrateChainIds,
  type SupportedSubstrateChains,
  supportedSubstrateChainsSet,
} from "@sk-widget/domain/types/chains/substrate";
import { MiscNetworks } from "@stakekit/common";

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

export const isSupportedChain = (chain: string): chain is SupportedSKChains => {
  return (
    isEvmChain(chain) ||
    supportedCosmosChainsSet.has(chain as SupportedCosmosChains) ||
    supportedMiscChainsSet.has(chain as SupportedMiscChains) ||
    supportedSubstrateChainsSet.has(chain as SupportedSubstrateChains)
  );
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
