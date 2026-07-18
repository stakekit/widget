import { Context, Data, Deferred, Effect, Layer } from "effect";
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
} from "./domain/errors";
import { disconnectedNormalizedWalletState } from "./domain/state";
import type { WalletSignTransactionInput } from "./domain/transactions";
import type { WalletBinding } from "./router";
import {
  routeWalletAccountSwitch,
  routeWalletMessage,
  routeWalletTransaction,
} from "./router";
import {
  makeBootstrappingWalletRuntime,
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
  let activeBinding: object | null = null;
  const bindingReady = yield* Deferred.make<void>();
  let hasBound = false;
  let currentBinding: WalletBinding | null = null;

  const bind = (binding: WalletBinding) =>
    Effect.acquireRelease(
      Effect.gen(function* () {
        const identity = yield* Effect.sync(() => {
          const identity = {};
          activeBinding = identity;
          currentBinding = binding;
          hasBound = true;
          return identity;
        });
        yield* Deferred.succeed(bindingReady, undefined);
        return identity;
      }),
      (identity) =>
        Effect.sync(() => {
          if (activeBinding !== identity) return;

          activeBinding = null;
          currentBinding = null;
        })
    ).pipe(Effect.asVoid);

  const withCurrent = <A, E>(
    use: (binding: WalletBinding) => Effect.Effect<A, E>,
    unavailable: () => E
  ): Effect.Effect<A, E> =>
    Effect.suspend(() => {
      if (currentBinding) return use(currentBinding);
      if (hasBound) return Effect.fail(unavailable());

      return Deferred.await(bindingReady).pipe(
        Effect.andThen(
          Effect.suspend(() =>
            currentBinding ? use(currentBinding) : Effect.fail(unavailable())
          )
        )
      );
    });

  return {
    bind,
    changes: runtime.changes,
    config: runtime.config,
    current: runtime.current,
    disconnect: (input?: WalletDisconnectInput) =>
      withCurrent(
        (binding) => binding.actions.disconnect(input),
        () =>
          new WalletConnectionError({
            cause: serviceUnavailable(),
            operation: "disconnect",
          })
      ),
    getState: () => currentBinding?.state ?? disconnectedNormalizedWalletState,
    persistPublicKey: (input: {
      readonly address: WalletAddress;
      readonly publicKey: string;
    }) => persistence.upsertStoredPublicKey(input),
    signMessage: (input: WalletSignMessageInput) =>
      withCurrent(
        (binding) => routeWalletMessage(binding, input),
        () =>
          new WalletCapabilityUnavailableError({
            capability: "message",
            connectorId: null,
          })
      ),
    signTransaction: (input: WalletSignTransactionInput) =>
      withCurrent(
        (binding) => routeWalletTransaction(binding, input),
        () =>
          new WalletCapabilityUnavailableError({
            capability: "transaction",
            connectorId: null,
          })
      ),
    switchAccount: (input: WalletSwitchAccountInput) =>
      withCurrent(
        (binding) => routeWalletAccountSwitch(binding, input),
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
  static readonly legacyLayer = Layer.effect(
    WalletService,
    makeWalletService(makeBootstrappingWalletRuntime())
  );

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
