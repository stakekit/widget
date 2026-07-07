import { Effect } from "effect";
import type { Chain } from "viem";
import type { Connector } from "wagmi";
import {
  type BorrowNetwork,
  borrowChainEntries,
  borrowChainsByNetwork,
  borrowViemChains,
  type ChainId,
  type ConnectedWalletState,
  type DisconnectedWalletState,
  decodeChainId,
  decodeWalletAddress,
  getBorrowNetworkForChainId,
  isBorrowNetwork,
  SwitchChainError,
  type WalletChain,
} from "../domain";

type BorrowWalletBridgeInput = {
  readonly address: string | null;
  readonly chain: Chain | null;
  readonly connector?: Pick<Connector, "switchChain"> | null;
  readonly connectorChains: ReadonlyArray<Chain>;
  readonly isConnected: boolean;
  readonly network: string | null;
};

export type BorrowWalletDisconnectedBridgeState = {
  readonly status: "disconnected";
  readonly wallet: typeof DisconnectedWalletState.Type;
};

export type BorrowWalletUnsupportedNetworkBridgeState = {
  readonly status: "unsupported-network";
  readonly chainId: number | null;
  readonly network: string | null;
  readonly supportedChains: ReadonlyArray<WalletChain>;
};

export type BorrowWalletConnectedBridgeState = {
  readonly status: "connected";
  readonly switchChain: (
    chainId: ChainId
  ) => Effect.Effect<void, SwitchChainError>;
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

export const getSupportedBorrowWalletChains = (
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

export const switchBorrowWalletChain = ({
  chainId,
  connector,
}: {
  readonly chainId: ChainId;
  readonly connector?: Pick<Connector, "switchChain"> | null;
}) => {
  const switchChain = connector?.switchChain;

  return switchChain
    ? Effect.tryPromise({
        try: () => switchChain({ chainId: Number(chainId) }),
        catch: (cause) => new SwitchChainError({ cause }),
      }).pipe(Effect.asVoid)
    : Effect.fail(
        new SwitchChainError({
          cause: new Error("Current wallet connector cannot switch chains."),
        })
      );
};

export const toBorrowWalletBridgeState = (
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

  const currentAccount = {
    address: decodeWalletAddress(wallet.address),
  };
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
    switchChain: (chainId) =>
      switchBorrowWalletChain({ chainId, connector: wallet.connector }),
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
