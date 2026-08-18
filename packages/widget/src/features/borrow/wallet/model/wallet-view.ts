import {
  getBorrowNetworkForChainId,
  isBorrowNetwork,
} from "../../../../domain/borrow/network";
import type { NormalizedWalletState } from "../../../../services/wallet/wallet-state";

export type BorrowWalletView =
  | { readonly status: "ready" }
  | { readonly status: "connection-required" }
  | { readonly status: "unsupported-network" };

export const projectBorrowWalletView = (
  wallet: NormalizedWalletState
): BorrowWalletView => {
  if (wallet.status === "unsupported") {
    return { status: "unsupported-network" };
  }

  if (wallet.status !== "connected") {
    return { status: "connection-required" };
  }

  if (
    !isBorrowNetwork(wallet.network) ||
    getBorrowNetworkForChainId(wallet.chain.id) !== wallet.network
  ) {
    return { status: "unsupported-network" };
  }

  return { status: "ready" };
};
