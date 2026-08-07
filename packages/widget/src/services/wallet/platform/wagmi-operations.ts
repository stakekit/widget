import { Context, Effect, Layer, Schema } from "effect";
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
import type { WalletEvmTransactionInput } from "../domain/transactions";

export class WagmiOperationsError extends Schema.TaggedErrorClass<WagmiOperationsError>()(
  "WagmiOperationsError",
  {
    cause: Schema.Defect(),
    operation: Schema.Literals([
      "connect",
      "disconnect",
      "reconnect",
      "send-transaction",
      "sign-message",
      "switch-chain",
    ]),
  }
) {}

export const wagmiOperations = {
  connect: Effect.fn("connect")(function* (
    config: Config,
    input: WalletConnectInput
  ): Effect.fn.Return<
    { readonly accounts: readonly Address[]; readonly chainId: number },
    WagmiOperationsError
  > {
    return yield* Effect.tryPromise({
      try: () => connect(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "connect" }),
    });
  }),
  disconnect: Effect.fn("disconnect")(function* (
    config: Config,
    input?: WalletDisconnectInput
  ): Effect.fn.Return<void, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => disconnect(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "disconnect" }),
    });
  }),
  reconnect: Effect.fn("reconnect")(function* (
    config: Config,
    input?: WalletReconnectInput
  ): Effect.fn.Return<ReadonlyArray<Connection>, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => reconnect(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "reconnect" }),
    });
  }),
  sendTransaction: Effect.fn("sendTransaction")(function* (
    config: Config,
    input: WalletEvmTransactionInput
  ): Effect.fn.Return<Hash, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => sendTransaction(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "send-transaction" }),
    });
  }),
  signMessage: Effect.fn("signMessage")(function* (
    config: Config,
    input: WalletSignMessageInput
  ): Effect.fn.Return<Hex, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => signMessage(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "sign-message" }),
    });
  }),
  switchChain: Effect.fn("switchChain")(function* (
    config: Config,
    input: WalletSwitchChainInput
  ): Effect.fn.Return<{ readonly id: number }, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => switchChain(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "switch-chain" }),
    });
  }),
};

export type WagmiOperationsService = typeof wagmiOperations;

export class WagmiOperations extends Context.Service<
  WagmiOperations,
  WagmiOperationsService
>()("stakekit/widget/wallet/platform/WagmiOperations") {
  static readonly layer = Layer.succeed(
    WagmiOperations,
    WagmiOperations.of(wagmiOperations)
  );
}
