import { Effect } from "effect";
import type { Address, Hash, Hex } from "viem";
import type { Config, Connection } from "wagmi";
import {
  connect,
  disconnect,
  reconnect,
  sendTransaction,
  signMessage,
  switchChain,
} from "wagmi/actions";
import type {
  WalletConnectInput,
  WalletDisconnectInput,
  WalletReconnectInput,
  WalletSignMessageInput,
  WalletSwitchChainInput,
} from "../domain/commands";
import {
  WalletBroadcastError,
  WalletConnectionError,
  WalletSigningError,
  WalletSwitchError,
} from "../domain/errors";
import type {
  WalletBroadcastResult,
  WalletEvmTransactionInput,
} from "../domain/transactions";

export const wagmiActionOperations = {
  connect: (
    config: Config,
    input: WalletConnectInput
  ): Promise<{
    readonly accounts: readonly Address[];
    readonly chainId: number;
  }> => connect(config, input),
  disconnect: (config: Config, input?: WalletDisconnectInput): Promise<void> =>
    disconnect(config, input),
  reconnect: (
    config: Config,
    input?: WalletReconnectInput
  ): Promise<ReadonlyArray<Connection>> => reconnect(config, input),
  sendTransaction: (
    config: Config,
    input: WalletEvmTransactionInput
  ): Promise<Hash> => sendTransaction(config, input),
  signMessage: (config: Config, input: WalletSignMessageInput): Promise<Hex> =>
    signMessage(config, input),
  switchChain: (
    config: Config,
    input: WalletSwitchChainInput
  ): Promise<{ readonly id: number }> => switchChain(config, input),
};

export type WagmiActionOperations = typeof wagmiActionOperations;

export const makeWagmiActions = ({
  config,
  operations = wagmiActionOperations,
}: {
  readonly config: Config;
  readonly operations?: WagmiActionOperations;
}) => ({
  connect: (input: WalletConnectInput) =>
    Effect.tryPromise({
      try: () => operations.connect(config, input),
      catch: (cause) =>
        new WalletConnectionError({ cause, operation: "connect" }),
    }),
  disconnect: (input?: WalletDisconnectInput) =>
    Effect.tryPromise({
      try: () => operations.disconnect(config, input),
      catch: (cause) =>
        new WalletConnectionError({ cause, operation: "disconnect" }),
    }),
  reconnect: (input?: WalletReconnectInput) =>
    Effect.tryPromise({
      try: () => operations.reconnect(config, input),
      catch: (cause) =>
        new WalletConnectionError({ cause, operation: "reconnect" }),
    }),
  sendEvmTransaction: (input: WalletEvmTransactionInput) =>
    Effect.tryPromise({
      // Use Wagmi's current connection, as the compatibility hook did. Passing
      // the connector makes Wagmi refetch accounts before every wallet action.
      try: () =>
        operations.sendTransaction(config, { ...input, connector: undefined }),
      catch: (cause) =>
        new WalletBroadcastError({ cause, customMessage: null }),
    }).pipe(
      Effect.map(
        (signedTx) =>
          ({ broadcasted: true, signedTx }) satisfies WalletBroadcastResult
      )
    ),
  signMessage: (input: WalletSignMessageInput) =>
    Effect.tryPromise({
      // Keep connector selection aligned with the current Wagmi connection.
      try: () =>
        operations.signMessage(config, { ...input, connector: undefined }),
      catch: (cause) => new WalletSigningError({ cause, operation: "message" }),
    }),
  switchChain: (input: WalletSwitchChainInput) =>
    Effect.tryPromise({
      try: () => operations.switchChain(config, input),
      catch: (cause) =>
        new WalletSwitchError({
          cause,
          operation: "chain",
          target: input.chainId,
        }),
    }),
});

export type WagmiActions = ReturnType<typeof makeWagmiActions>;
