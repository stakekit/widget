import type { Chain } from "viem";
import { decodeChainId } from "../../domain/borrow/ids";
import {
  type BorrowNetwork,
  borrowChainEntries,
  borrowChainsByNetwork,
  borrowViemChains,
  getBorrowNetworkForChainId,
  isBorrowNetwork,
} from "../../domain/borrow/network";
import type {
  ConnectedWalletState,
  DisconnectedWalletState,
  WalletChain,
} from "../../domain/borrow/wallet";
import type { WalletAddress } from "../../domain/identity/identifiers";
import type { NormalizedWalletState } from "../wallet/wallet-state";

type BorrowWalletBridgeInput = {
  readonly address: WalletAddress | null;
  readonly chain: Chain | null;
  readonly connectorChains: ReadonlyArray<Chain>;
  readonly isConnected: boolean;
  readonly network: string | null;
};

type BorrowWalletDisconnectedBridgeState = {
  readonly status: "disconnected";
  readonly wallet: typeof DisconnectedWalletState.Type;
};

type BorrowWalletUnsupportedNetworkBridgeState = {
  readonly status: "unsupported-network";
  readonly chainId: number | null;
  readonly network: string | null;
  readonly supportedChains: ReadonlyArray<WalletChain>;
};

export type BorrowWalletConnectedBridgeState = {
  readonly status: "connected";
  readonly wallet: typeof ConnectedWalletState.Type;
};

export type BorrowWalletBridgeState =
  | BorrowWalletConnectedBridgeState
  | BorrowWalletDisconnectedBridgeState
  | BorrowWalletUnsupportedNetworkBridgeState;

const toWalletChain = ([network, chain]: readonly [
  BorrowNetwork,
  Chain,
]): WalletChain => ({
  chainId: decodeChainId(chain.id),
  iconUrl: `https://assets.stakek.it/networks/${network}.svg`,
  name: chain.name,
  network,
});

const getSupportedBorrowWalletChains = (
  connectorChains: ReadonlyArray<Chain>
): ReadonlyArray<WalletChain> => {
  const connectorChainIds = new Set(connectorChains.map((chain) => chain.id));
  const chains =
    connectorChainIds.size > 0
      ? borrowChainEntries.filter(([, chain]) =>
          connectorChainIds.has(chain.id)
        )
      : borrowChainEntries;

  return chains.map(toWalletChain);
};

const projectBorrowWalletState = (
  wallet: BorrowWalletBridgeInput
): BorrowWalletBridgeState => {
  const supportedChains = getSupportedBorrowWalletChains(
    wallet.connectorChains
  );

  if (!wallet.isConnected || !wallet.address || !wallet.chain) {
    return {
      status: "disconnected",
      wallet: { status: "disconnected" },
    };
  }

  const network =
    wallet.network && isBorrowNetwork(wallet.network) ? wallet.network : null;

  if (!network || getBorrowNetworkForChainId(wallet.chain.id) !== network) {
    return {
      status: "unsupported-network",
      chainId: wallet.chain.id,
      network: wallet.network,
      supportedChains,
    };
  }

  const currentAccount = { address: wallet.address };
  const currentChain =
    supportedChains.find((chain) => chain.network === network) ??
    toWalletChain([network, borrowChainsByNetwork[network]]);
  const chains =
    supportedChains.length > 0
      ? supportedChains
      : borrowViemChains.map((chain) =>
          toWalletChain([
            getBorrowNetworkForChainId(chain.id) ?? network,
            chain,
          ])
        );

  return {
    status: "connected",
    wallet: {
      status: "connected",
      accounts: [currentAccount],
      chains: [
        currentChain,
        ...chains.filter((chain) => chain !== currentChain),
      ],
      currentAccount,
      currentChain,
      network,
    },
  };
};

export const toBorrowWalletStateProjection = (
  wallet: NormalizedWalletState
): BorrowWalletBridgeState =>
  projectBorrowWalletState({
    address: wallet.address,
    chain: wallet.chain,
    connectorChains: wallet.connectorChains,
    isConnected:
      wallet.status === "connected" || wallet.status === "unsupported",
    network: wallet.network,
  });
