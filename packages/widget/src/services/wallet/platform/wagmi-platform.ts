import {
  Context,
  Effect,
  Layer,
  Queue,
  Schema,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import {
  getConnection,
  getConnectors,
  watchConnection,
  watchConnectors,
} from "wagmi/actions";
import type { WalletCoreState } from "../domain/state";
import { makeInitializeWallet } from "../initial-connection";
import {
  type BuildWagmiConfigOptions,
  buildWagmiConfig,
  type WalletController,
} from "../wagmi-config";
import { WagmiOperations } from "./wagmi-operations";

class WagmiPlatformError extends Schema.TaggedErrorClass<WagmiPlatformError>()(
  "WagmiPlatformError",
  {
    cause: Schema.Defect(),
    operation: Schema.Literals(["build-config", "observe-core"]),
  }
) {}

export type WagmiCoreObservation = {
  readonly current: Effect.Effect<WalletCoreState>;
  readonly states: Stream.Stream<WalletCoreState>;
};

type WagmiBuildConfigOptions = Omit<
  BuildWagmiConfigOptions,
  "persistPublicKey"
> & {
  readonly persistPublicKey: (
    input: Parameters<BuildWagmiConfigOptions["persistPublicKey"]>[0]
  ) => Effect.Effect<void, unknown>;
};

export type WagmiPlatformService = {
  readonly buildConfig: (
    options: WagmiBuildConfigOptions
  ) => Effect.Effect<WalletController, WagmiPlatformError, Scope.Scope>;
  readonly initialize: (input: {
    readonly hasExternalProvider: boolean;
    readonly isLedgerDappBrowser: boolean;
    readonly isMobileWallet: boolean;
    readonly queryParamsInitChainId: number | undefined;
    readonly wagmiConfig: WalletController["wagmiConfig"];
  }) => Effect.Effect<void>;
  readonly observeCore: (
    controller: WalletController
  ) => Effect.Effect<WagmiCoreObservation, WagmiPlatformError, Scope.Scope>;
};

const observeConnection = (controller: WalletController) =>
  Stream.callback<WalletCoreState["connection"], WagmiPlatformError>(
    (queue) =>
      Effect.acquireRelease(
        Effect.try({
          try: () => {
            const unsubscribe = watchConnection(controller.wagmiConfig, {
              onChange: (connection) => {
                Queue.offerUnsafe(queue, connection);
              },
            });
            Queue.offerUnsafe(queue, getConnection(controller.wagmiConfig));
            return unsubscribe;
          },
          catch: (cause) =>
            new WagmiPlatformError({ cause, operation: "observe-core" }),
        }),
        (unsubscribe) => Effect.sync(unsubscribe)
      ),
    { bufferSize: 1, strategy: "sliding" }
  );

const observeConnectors = (controller: WalletController) =>
  Stream.callback<WalletCoreState["connectors"], WagmiPlatformError>(
    (queue) =>
      Effect.acquireRelease(
        Effect.try({
          try: () => {
            const unsubscribe = watchConnectors(controller.wagmiConfig, {
              onChange: (connectors) => {
                Queue.offerUnsafe(queue, connectors);
              },
            });
            Queue.offerUnsafe(queue, getConnectors(controller.wagmiConfig));
            return unsubscribe;
          },
          catch: (cause) =>
            new WagmiPlatformError({ cause, operation: "observe-core" }),
        }),
        (unsubscribe) => Effect.sync(unsubscribe)
      ),
    { bufferSize: 1, strategy: "sliding" }
  );

const observeCore = Effect.fn("observeCore")(function* (
  controller: WalletController
) {
  const coreStates = Stream.zipLatestAll(
    observeConnection(controller),
    observeConnectors(controller)
  ).pipe(
    Stream.map(
      ([connection, connectors]): WalletCoreState => ({
        connection,
        connectors,
      })
    )
  );
  const queue = yield* coreStates.pipe(
    Stream.toQueue({ capacity: 16, strategy: "sliding" })
  );
  const initial = yield* Queue.take(queue).pipe(
    Effect.mapError(
      (cause) => new WagmiPlatformError({ cause, operation: "observe-core" })
    )
  );
  const state = yield* SubscriptionRef.make(initial);
  yield* Stream.fromQueue(queue).pipe(
    Stream.runForEach((next) => SubscriptionRef.set(state, next)),
    Effect.forkScoped({ startImmediately: true })
  );

  return {
    current: SubscriptionRef.get(state),
    states: SubscriptionRef.changes(state),
  } satisfies WagmiCoreObservation;
});

export class WagmiPlatform extends Context.Service<
  WagmiPlatform,
  WagmiPlatformService
>()("stakekit/widget/wallet/platform/WagmiPlatform") {
  static readonly layer = Layer.effect(
    WagmiPlatform,
    Effect.gen(function* () {
      const initialize = yield* makeInitializeWallet;
      const operations = yield* WagmiOperations;
      const buildConfig = Effect.fn("buildConfig")(function* (
        options: WagmiBuildConfigOptions
      ) {
        return yield* buildWagmiConfig(options).pipe(
          Effect.provideService(WagmiOperations, operations),
          Effect.mapError(
            (cause) =>
              new WagmiPlatformError({ cause, operation: "build-config" })
          )
        );
      });
      return WagmiPlatform.of({
        buildConfig,
        initialize,
        observeCore,
      });
    })
  );

  static readonly defaultLayer = WagmiPlatform.layer.pipe(
    Layer.provide(WagmiOperations.layer)
  );
}
