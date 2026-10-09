import { Context, Effect, Layer, Schema } from "effect";
import type { Address, Hash, Hex } from "viem";
import {
  type Config,
  type Connection,
  type Connector,
  ConnectorAlreadyConnectedError,
} from "wagmi";
import {
  disconnect,
  reconnect,
  sendTransaction,
  signMessage,
  signTypedData,
  switchChain,
} from "wagmi/actions";
import type {
  WalletConnectInput,
  WalletDisconnectInput,
  WalletReconnectInput,
  WalletSignMessageInput,
  WalletSignTypedDataInput,
  WalletSwitchChainInput,
} from "../../wallet-commands";
import type { WalletEvmTransactionInput } from "../../wallet-transactions";

export class WagmiOperationsError extends Schema.TaggedError<WagmiOperationsError>()(
  "WagmiOperationsError",
  {
    cause: Schema.Defect(),
    operation: Schema.Literals([
      "connect",
      "disconnect",
      "reconnect",
      "send-transaction",
      "sign-message",
      "sign-typed-data",
      "switch-chain",
    ]),
  }
) {}

const connectionOwners = new WeakMap<
  Config,
  {
    pending: symbol | undefined;
    readonly connectors: Map<Connector, () => void>;
  }
>();

const connectionOwner = (config: Config) => {
  const current = connectionOwners.get(config);
  if (current) return current;
  const owner = {
    pending: undefined as symbol | undefined,
    connectors: new Map<Connector, () => void>(),
  };
  connectionOwners.set(config, owner);
  return owner;
};

const detachCoreListeners = (config: Config, connector: Connector) => {
  const events = config._internal.events;
  connector.emitter.off("connect", events.connect);
  connector.emitter.off("change", events.change);
  connector.emitter.off("disconnect", events.disconnect);
};

const ownConnector = (config: Config, connector: Connector) => {
  const owner = connectionOwner(config);
  detachCoreListeners(config, connector);
  if (owner.connectors.has(connector)) return;
  const events = config._internal.events;
  // Native approvals carry connector identity, not request identity. Only the
  // connector whose Promise we accepted may publish account or session changes.
  const onChange: typeof events.change = (data) => {
    if (config.state.current === connector.uid) events.change(data);
  };
  const onDisconnect: typeof events.disconnect = (data) => {
    if (config.state.current !== connector.uid) {
      if (config.state.connections.has(connector.uid)) {
        config.setState((state) => {
          const connections = new Map(state.connections);
          connections.delete(connector.uid);
          return { ...state, connections };
        });
      }
      return;
    }
    events.disconnect(data);
    detachCoreListeners(config, connector);
  };
  connector.emitter.on("change", onChange);
  connector.emitter.on("disconnect", onDisconnect);
  owner.connectors.set(connector, () => {
    connector.emitter.off("change", onChange);
    connector.emitter.off("disconnect", onDisconnect);
    detachCoreListeners(config, connector);
  });
};

export const ownWagmiConnections = (config: Config) => {
  for (const connector of config.connectors) ownConnector(config, connector);
  const unsubscribe = config._internal.connectors.subscribe((connectors) => {
    for (const connector of connectors) ownConnector(config, connector);
  });
  return () => {
    unsubscribe();
    const owner = connectionOwners.get(config);
    owner?.connectors.forEach((dispose) => dispose());
    connectionOwners.delete(config);
  };
};

export const wagmiOperations = {
  connect: Effect.fn("connect")(function* (
    config: Config,
    input: WalletConnectInput
  ): Effect.fn.Return<
    { readonly accounts: readonly Address[]; readonly chainId: number },
    WagmiOperationsError
  > {
    const owner = connectionOwner(config);
    const isCurrent = input.isCurrent ?? Effect.succeed(true);
    if (!(yield* isCurrent)) return yield* Effect.interrupt;
    if (config.state.current === input.connector.uid) {
      return yield* new WagmiOperationsError({
        cause: new ConnectorAlreadyConnectedError(),
        operation: "connect",
      });
    }

    const attempt = Symbol();
    owner.pending = attempt;
    for (const connector of config.connectors) ownConnector(config, connector);
    ownConnector(config, input.connector);
    config.setState((state) => ({ ...state, status: "connecting" }));
    input.connector.emitter.emit("message", { type: "connecting" });

    return yield* Effect.gen(function* () {
      // Wagmi's connect action commits after awaiting the non-abortable SDK
      // Promise. Await the connector directly so cancellation precedes all
      // connection state writes and listener ownership stays here.
      const result = yield* Effect.tryPromise({
        try: () =>
          input.connector.connect({
            chainId: input.chainId,
            withCapabilities: false,
          }),
        catch: (cause) =>
          new WagmiOperationsError({ cause, operation: "connect" }),
      });
      if (owner.pending !== attempt || !(yield* isCurrent)) {
        return yield* Effect.interrupt;
      }
      yield* Effect.tryPromise({
        try: async () => {
          await config.storage?.setItem(
            "recentConnectorId",
            input.connector.id
          );
        },
        catch: (cause) =>
          new WagmiOperationsError({ cause, operation: "connect" }),
      });
      if (owner.pending !== attempt || !(yield* isCurrent)) {
        return yield* Effect.interrupt;
      }
      config.setState((state) => ({
        ...state,
        connections: new Map(state.connections).set(input.connector.uid, {
          accounts: result.accounts as Connection["accounts"],
          chainId: result.chainId,
          connector: input.connector,
        }),
        current: input.connector.uid,
        status: "connected",
      }));
      return result;
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          if (owner.pending !== attempt) return;
          owner.pending = undefined;
          config.setState((state) => ({
            ...state,
            status: state.current ? "connected" : "disconnected",
          }));
        })
      )
    );
  }),
  disconnect: Effect.fn("disconnect")(function* (
    config: Config,
    input?: WalletDisconnectInput
  ): Effect.fn.Return<void, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => disconnect(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "disconnect" }),
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          for (const connector of config.connectors)
            ownConnector(config, connector);
        })
      )
    );
  }),
  reconnect: Effect.fn("reconnect")(function* (
    config: Config,
    input?: WalletReconnectInput
  ): Effect.fn.Return<ReadonlyArray<Connection>, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => reconnect(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "reconnect" }),
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => {
          for (const connector of config.connectors)
            ownConnector(config, connector);
        })
      )
    );
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
  signTypedData: Effect.fn("signTypedData")(function* (
    config: Config,
    input: WalletSignTypedDataInput
  ): Effect.fn.Return<Hex, WagmiOperationsError> {
    return yield* Effect.tryPromise({
      try: () => signTypedData(config, input),
      catch: (cause) =>
        new WagmiOperationsError({ cause, operation: "sign-typed-data" }),
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
