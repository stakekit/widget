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

const borrowChainsByNetwork: Record<BorrowNetwork, Chain> = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
};

const borrowChainEntries = Object.entries(borrowChainsByNetwork) as [
  BorrowNetwork,
  Chain,
][];

const borrowChainIdsToNetworks = Object.fromEntries(
  borrowChainEntries.map(([network, chain]) => [
    decodeChainId(chain.id),
    network,
  ])
) as Record<ChainId, BorrowNetwork>;

export const isBorrowNetwork = Schema.is(BorrowNetwork);

export const getBorrowNetworkForChainId = (
  chainId: number | string
): BorrowNetwork | null =>
  borrowChainIdsToNetworks[decodeChainId(chainId)] ?? null;
