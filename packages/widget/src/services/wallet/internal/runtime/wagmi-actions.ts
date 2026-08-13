import { Effect } from "effect";
import type { Config } from "wagmi";
import type {
  WalletConnectInput,
  WalletDisconnectInput,
  WalletReconnectInput,
  WalletSignMessageInput,
  WalletSwitchChainInput,
} from "../../wallet-commands";
import {
  WalletBroadcastError,
  WalletConnectionError,
  WalletSigningError,
  WalletSwitchError,
} from "../../wallet-errors";
import type {
  WalletBroadcastResult,
  WalletEvmTransactionInput,
} from "../../wallet-transactions";
import { WagmiOperations } from "../platform/wagmi-operations";

export const makeWagmiActions = Effect.gen(function* () {
  const operations = yield* WagmiOperations;
  return ({ config }: { readonly config: Config }) => ({
    connect: Effect.fn("connect")(function* (input: WalletConnectInput) {
      return yield* operations.connect(config, input).pipe(
        Effect.mapError(
          (error) =>
            new WalletConnectionError({
              cause: error.cause,
              operation: "connect",
            })
        )
      );
    }),
    disconnect: Effect.fn("disconnect")(function* (
      input?: WalletDisconnectInput
    ) {
      return yield* operations.disconnect(config, input).pipe(
        Effect.mapError(
          (error) =>
            new WalletConnectionError({
              cause: error.cause,
              operation: "disconnect",
            })
        )
      );
    }),
    reconnect: Effect.fn("reconnect")(function* (input?: WalletReconnectInput) {
      return yield* operations.reconnect(config, input).pipe(
        Effect.mapError(
          (error) =>
            new WalletConnectionError({
              cause: error.cause,
              operation: "reconnect",
            })
        )
      );
    }),
    sendEvmTransaction: Effect.fn("sendEvmTransaction")(function* (
      input: WalletEvmTransactionInput
    ) {
      return yield* operations
        .sendTransaction(config, {
          // Use Wagmi's current connection, as the compatibility hook did. Passing
          // the connector makes Wagmi refetch accounts before every wallet action.
          ...input,
          connector: undefined,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new WalletBroadcastError({
                cause: error.cause,
                customMessage: null,
              })
          ),
          Effect.map(
            (signedTx) =>
              ({
                broadcasted: true,
                signedTx,
              }) satisfies WalletBroadcastResult
          )
        );
    }),
    signMessage: Effect.fn("signMessage")(function* (
      input: WalletSignMessageInput
    ) {
      return yield* operations
        .signMessage(config, {
          // Keep connector selection aligned with the current Wagmi connection.
          ...input,
          connector: undefined,
        })
        .pipe(
          Effect.mapError(
            (error) =>
              new WalletSigningError({
                cause: error.cause,
                operation: "message",
              })
          )
        );
    }),
    switchChain: Effect.fn("switchChain")(function* (
      input: WalletSwitchChainInput
    ) {
      return yield* operations.switchChain(config, input).pipe(
        Effect.mapError(
          (error) =>
            new WalletSwitchError({
              cause: error.cause,
              operation: "chain",
              target: input.chainId,
            })
        )
      );
    }),
  });
});

export type WagmiActions = ReturnType<Effect.Success<typeof makeWagmiActions>>;
