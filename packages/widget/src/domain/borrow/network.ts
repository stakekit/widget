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

const borrowChainIdsToNetworks = new Map<ChainId, BorrowNetwork>(
  borrowNetworks.map((network) => [
    decodeChainId(borrowChainsByNetwork[network].id),
    network,
  ])
);

export const isBorrowNetwork = Schema.is(BorrowNetwork);

export const getBorrowNetworkForChainId = (
  chainId: number | string
): BorrowNetwork | null =>
  borrowChainIdsToNetworks.get(decodeChainId(chainId)) ?? null;
