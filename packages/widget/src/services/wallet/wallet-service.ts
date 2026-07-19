import { Context, Effect, Layer, Stream } from "effect";
import type { WalletAddress } from "../../domain/schema/identifiers";
import { WidgetPersistence } from "../persistence/widget-persistence";
import { bootstrapWallet, WalletBootstrapError } from "./bootstrap";
import type {
  WalletDisconnectInput,
  WalletSignMessageInput,
  WalletSwitchAccountInput,
} from "./domain/commands";
import type { WalletSignTransactionInput } from "./domain/transactions";
import { installExternalProviderSynchronization } from "./external-provider-sync";
import { makeWalletLifecyclePolicy } from "./lifecycle";
import { SolanaPlatform } from "./platform/solana-platform";
import { WagmiPlatform } from "./platform/wagmi-platform";
import { WalletEnvironment } from "./platform/wallet-environment";
import type { WalletRoutingContext } from "./router";
import {
  routeWalletAccountSwitch,
  routeWalletMessage,
  routeWalletTransaction,
} from "./router";
import { makeWalletStateRuntime } from "./wallet-state";

export * from "./domain/commands";
export * from "./domain/errors";
export * from "./domain/transactions";

const makeWalletService = Effect.fn("makeWalletService")(function* () {
  const persistence = yield* WidgetPersistence;
  const bootstrap = yield* bootstrapWallet();
  const state = yield* makeWalletStateRuntime({
    controller: bootstrap.controller,
    core: bootstrap.core,
    readStoredPublicKeys: persistence.readStoredPublicKeys,
  }).pipe(
    Effect.mapError(
      (cause) => new WalletBootstrapError({ cause, stage: "wallet-state" })
    )
  );
  const lifecycle = yield* makeWalletLifecyclePolicy;

  yield* installExternalProviderSynchronization({ bootstrap, state });
  yield* state.contexts.pipe(
    Stream.runForEach((context) => {
      return lifecycle.transition({
        actions: context.routing.actions,
        state: context.state.connection,
      });
    }),
    Effect.forkScoped({ startImmediately: true })
  );

  const withContext = Effect.fn("withContext")(function* <A, E>(
    use: (routing: WalletRoutingContext) => Effect.Effect<A, E>
  ) {
    const context = yield* state.context;
    return yield* use(context.routing);
  });

  return {
    disconnect: Effect.fn("disconnect")(function* (
      input?: WalletDisconnectInput
    ) {
      return yield* withContext((routing) => routing.actions.disconnect(input));
    }),
    persistPublicKey: Effect.fn("persistPublicKey")(function* (input: {
      readonly address: WalletAddress;
      readonly publicKey: string;
    }) {
      yield* persistence.upsertStoredPublicKey(input);
    }),
    signMessage: Effect.fn("signMessage")(function* (
      input: WalletSignMessageInput
    ) {
      return yield* withContext((routing) =>
        routeWalletMessage(routing, input)
      );
    }),
    signTransaction: Effect.fn("signTransaction")(function* (
      input: WalletSignTransactionInput
    ) {
      return yield* withContext((routing) =>
        routeWalletTransaction(routing, input)
      );
    }),
    state: state.context.pipe(Effect.map((context) => context.state)),
    states: state.contexts.pipe(Stream.map((context) => context.state)),
    switchAccount: Effect.fn("switchAccount")(function* (
      input: WalletSwitchAccountInput
    ) {
      return yield* withContext((routing) =>
        routeWalletAccountSwitch(routing, input)
      );
    }),
    wagmiConfig: bootstrap.controller.wagmiConfig,
  } as const;
});

export class WalletService extends Context.Service<WalletService>()(
  "stakekit/widget/WalletService",
  {
    make: Effect.gen(function* () {
      return yield* makeWalletService();
    }),
  }
) {
  static readonly layer = Layer.effect(WalletService, WalletService.make);

  static readonly defaultLayer = WalletService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        SolanaPlatform.layer,
        WagmiPlatform.defaultLayer,
        WalletEnvironment.layer
      )
    )
  );
}
