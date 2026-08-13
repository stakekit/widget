import type { ChainGroup } from "@stakekit/rainbowkit";
import {
  EvmNetworks,
  MiscNetworks,
  SubstrateNetworks,
} from "../../domain/network/networks";
import {
  type SupportedMiscChains,
  supportedMiscChainsSet,
} from "./internal/adapters/configured-chains";
import {
  type SupportedCosmosChains,
  supportedCosmosChainsSet,
} from "./internal/adapters/cosmos/chains";
import {
  type SupportedEvmChain,
  supportedEVMChainsSet,
} from "./internal/adapters/evm/chains";
import {
  type SupportedSubstrateChains,
  supportedSubstrateChainsSet,
} from "./internal/adapters/substrate/chains";
import { getNetworkLogo } from "./network-assets";

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

export type SupportedSKChains =
  | SupportedCosmosChains
  | SupportedEvmChain
  | SupportedMiscChains
  | SupportedSubstrateChains;
