import { Context, Data, Effect, Layer } from "effect";
import type { WalletAddress } from "../../domain/schema/identifiers";
import { WidgetPersistence } from "../persistence/widget-persistence";
import type {
  WalletDisconnectInput,
  WalletSignMessageInput,
  WalletSwitchAccountInput,
} from "./domain/commands";
import {
  WalletCapabilityUnavailableError,
  WalletConnectionError,
  type WalletRuntimeTerminalError,
} from "./domain/errors";
import type { WalletSignTransactionInput } from "./domain/transactions";
import type { WalletRoutingContext } from "./router";
import {
  routeWalletAccountSwitch,
  routeWalletMessage,
  routeWalletTransaction,
} from "./router";
import {
  makeDefaultWalletRuntimeAdapters,
  makeWalletRuntime,
  type WalletRuntime,
  type WalletRuntimeAdapters,
} from "./runtime";

export * from "./domain/commands";
export * from "./domain/errors";
export * from "./domain/transactions";

class WalletServiceUnavailableError extends Data.TaggedError(
  "WalletServiceUnavailableError"
) {}

const serviceUnavailable = () => new WalletServiceUnavailableError();

const makeWalletService = Effect.fn("makeWalletService")(function* (
  runtime: WalletRuntime
) {
  const persistence = yield* WidgetPersistence;

  const withCurrent = <A, E>(
    use: (routing: WalletRoutingContext) => Effect.Effect<A, E>,
    unavailable: () => E
  ): Effect.Effect<A, E | WalletRuntimeTerminalError> =>
    runtime.captureRouting.pipe(
      Effect.flatMap((routing) =>
        routing ? use(routing) : Effect.fail(unavailable())
      )
    );

  return {
    changes: runtime.changes,
    config: runtime.config,
    current: runtime.current,
    disconnect: (input?: WalletDisconnectInput) =>
      withCurrent(
        (routing) => routing.actions.disconnect(input),
        () =>
          new WalletConnectionError({
            cause: serviceUnavailable(),
            operation: "disconnect",
          })
      ),
    getState: runtime.getState,
    persistPublicKey: (input: {
      readonly address: WalletAddress;
      readonly publicKey: string;
    }) => persistence.upsertStoredPublicKey(input),
    signMessage: (input: WalletSignMessageInput) =>
      withCurrent(
        (routing) => routeWalletMessage(routing, input),
        () =>
          new WalletCapabilityUnavailableError({
            capability: "message",
            connectorId: null,
          })
      ),
    signTransaction: (input: WalletSignTransactionInput) =>
      withCurrent(
        (routing) => routeWalletTransaction(routing, input),
        () =>
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: null,
          })
      ),
    switchAccount: (input: WalletSwitchAccountInput) =>
      withCurrent(
        (routing) => routeWalletAccountSwitch(routing, input),
        () =>
          new WalletCapabilityUnavailableError({
            capability: "account",
            connectorId: null,
          })
      ),
  } as const;
});

export type { WalletRuntimeAdapters } from "./runtime";

export class WalletService extends Context.Service<WalletService>()(
  "stakekit/widget/WalletService",
  {
    make: Effect.gen(function* () {
      const adapters = yield* makeDefaultWalletRuntimeAdapters;
      const runtime = yield* makeWalletRuntime(adapters);
      return yield* makeWalletService(runtime);
    }),
  }
) {
  static readonly layer = Layer.effect(WalletService, WalletService.make);

  static layerWithRuntimeAdapters(adapters: WalletRuntimeAdapters) {
    return Layer.effect(
      WalletService,
      Effect.gen(function* () {
        const runtime = yield* makeWalletRuntime(adapters);
        return yield* makeWalletService(runtime);
      })
    );
  }
}
