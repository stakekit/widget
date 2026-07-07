import { Schema } from "effect";
import type { Chain } from "viem";
import { arbitrum, base, mainnet, optimism } from "viem/chains";
import { type ChainId, decodeChainId } from "./ids";

export const BorrowNetwork = Schema.Literals([
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
]);
export type BorrowNetwork = typeof BorrowNetwork.Type;

export const supportedBorrowNetworks = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
] as const satisfies ReadonlyArray<BorrowNetwork>;

export const borrowChainsByNetwork: Record<BorrowNetwork, Chain> = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
};

export const borrowChainEntries = Object.entries(borrowChainsByNetwork) as [
  BorrowNetwork,
  Chain,
][];

export const borrowChainIdsToNetworks = Object.fromEntries(
  borrowChainEntries.map(([network, chain]) => [
    decodeChainId(chain.id),
    network,
  ])
) as Record<ChainId, BorrowNetwork>;

export const borrowViemChains = Object.values(
  borrowChainsByNetwork
) as ReadonlyArray<Chain>;

export const isBorrowNetwork = Schema.is(BorrowNetwork);

export const getBorrowNetworkForChainId = (
  chainId: number | string
): BorrowNetwork | null =>
  borrowChainIdsToNetworks[decodeChainId(chainId)] ?? null;
