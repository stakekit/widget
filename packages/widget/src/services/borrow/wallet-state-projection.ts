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
  getBorrowNetworkForChainId,
  isBorrowNetwork,
  SwitchChainError,
  type WalletChain,
} from "../../domain/borrow";
import type { WalletAddress } from "../../domain/schema/identifiers";
import type { NormalizedWalletState } from "../wallet/domain/state";

type BorrowWalletBridgeInput = {
  readonly address: WalletAddress | null;
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

export type BorrowWalletConnectedStateProjection = Omit<
  BorrowWalletConnectedBridgeState,
  "switchChain"
>;

export type BorrowWalletStateProjection =
  | BorrowWalletConnectedStateProjection
  | BorrowWalletDisconnectedBridgeState
  | BorrowWalletUnsupportedNetworkBridgeState;

export type BorrowSwitchChainCommandInput = {
  readonly chainId: ChainId;
  readonly connector?: Pick<Connector, "switchChain"> | null;
};

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
}: BorrowSwitchChainCommandInput) => {
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

const projectBorrowWalletState = (
  wallet: BorrowWalletBridgeInput
): BorrowWalletStateProjection => {
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
): BorrowWalletStateProjection =>
  projectBorrowWalletState({
    address: wallet.address,
    chain: wallet.chain,
    connector: wallet.connector,
    connectorChains: wallet.connectorChains,
    isConnected:
      wallet.status === "connected" || wallet.status === "unsupported",
    network: wallet.network,
  });

export const toBorrowSwitchChainCommandInput = ({
  chainId,
  wallet,
}: {
  readonly chainId: ChainId;
  readonly wallet: NormalizedWalletState;
}): BorrowSwitchChainCommandInput => ({
  chainId,
  connector:
    wallet.status === "connected" || wallet.status === "unsupported"
      ? wallet.connector
      : null,
});
