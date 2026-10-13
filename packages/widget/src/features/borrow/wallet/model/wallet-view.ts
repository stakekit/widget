import {
  getBorrowNetworkForChainId,
  isBorrowNetwork,
} from "../../../../domain/borrow/network";
import type { Chain } from "../../../../services/wallet/wallet-descriptors";
import type { NormalizedWalletState } from "../../../../services/wallet/wallet-state";

/** How a wallet outside Borrow's networks can get back to one. */
export type BorrowNetworkRecovery =
  /** The wallet can switch to these Borrow chains, preferred first. */
  | {
      readonly _tag: "SwitchChain";
      readonly chains: ReadonlyArray<Chain>;
    }
  /** The wallet has these Borrow chains but switches only from the wallet. */
  | {
      readonly _tag: "SwitchManually";
      readonly chains: ReadonlyArray<Chain>;
    }
  /** No wallet connection remains to switch; connecting starts over. */
  | { readonly _tag: "Connect" }
  /** None of the wallet's chains is a Borrow chain. */
  | { readonly _tag: "Unavailable" };

export type BorrowWalletView =
  | { readonly status: "ready" }
  | { readonly status: "connection-required" }
  | {
      readonly recovery: BorrowNetworkRecovery;
      readonly status: "unsupported-network";
    };

const projectRecovery = (
  wallet: NormalizedWalletState,
  initialChain: number | undefined
): BorrowNetworkRecovery => {
  if (!wallet.connector) return { _tag: "Connect" };

  const eligible = wallet.connectorChains.filter(
    (chain) => getBorrowNetworkForChainId(chain.id) !== null
  );
  if (eligible.length === 0) return { _tag: "Unavailable" };

  const preferred = eligible.filter((chain) => chain.id === initialChain);
  const others = eligible.filter((chain) => chain.id !== initialChain);
  const chains = [...preferred, ...others];
  return wallet.connector.switchChain
    ? { _tag: "SwitchChain", chains }
    : { _tag: "SwitchManually", chains };
};

export const projectBorrowWalletView = (
  wallet: NormalizedWalletState,
  initialChain?: number
): BorrowWalletView => {
  if (wallet.status === "unsupported") {
    return {
      recovery: projectRecovery(wallet, initialChain),
      status: "unsupported-network",
    };
  }

  if (wallet.status !== "connected") {
    return { status: "connection-required" };
  }

  if (
    !isBorrowNetwork(wallet.network) ||
    getBorrowNetworkForChainId(wallet.chain.id) !== wallet.network
  ) {
    return {
      recovery: projectRecovery(wallet, initialChain),
      status: "unsupported-network",
    };
  }

  return { status: "ready" };
};
