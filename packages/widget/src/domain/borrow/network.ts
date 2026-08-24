import { Schema } from "effect";
import type { Chain } from "viem";
import { arbitrum, base, mainnet, optimism } from "viem/chains";
import type { WalletNetwork } from "../wallet/network";
import { type ChainId, decodeChainId } from "./ids";

const borrowNetworks = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
] as const satisfies ReadonlyArray<WalletNetwork>;

export const BorrowNetwork = Schema.Literals(borrowNetworks);
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
