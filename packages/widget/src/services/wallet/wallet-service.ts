import type { Chain } from "@stakekit/rainbowkit";
import { Context, Duration, Effect, Layer, Stream } from "effect";
import { makeScopedSerialOperations } from "../../shared/effect/scoped-serial-operations";
import { WidgetPersistence } from "../persistence/widget-persistence";
import { isLedgerLiveConnector } from "./internal/adapters/ledger/ledger-live-connector-meta";
import { SolanaPlatform } from "./internal/platform/solana-platform";
import { WagmiPlatform } from "./internal/platform/wagmi-platform";
import { WalletEnvironment } from "./internal/platform/wallet-environment";
import {
  bootstrapWallet,
  WalletBootstrapError,
} from "./internal/runtime/bootstrap";
import { installExternalProviderSynchronization } from "./internal/runtime/external-provider-sync";
import { makeWalletLifecyclePolicy } from "./internal/runtime/lifecycle";
import type { WalletRoutingContext } from "./internal/runtime/router";
import {
  routeWalletAccountSwitch,
  routeWalletLedgerAccountRequest,
  routeWalletMessage,
  routeWalletTransaction,
  routeWalletTypedData,
} from "./internal/runtime/router";
import { makeWalletStateRuntime } from "./internal/runtime/state";
import { WalletStorageCleanup } from "./internal/runtime/wallet-storage-cleanup";
import {
  sameWalletCommandIdentity,
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "./wallet-command-identity";
import type {
  WalletSignMessageInput,
  WalletSignTypedDataInput,
  WalletSwitchAccountInput,
} from "./wallet-commands";
import type {
  WalletIntegrationError,
  WalletRuntimeInvariantError,
} from "./wallet-errors";
import { WalletModal } from "./wallet-modal";
import type { WalletSignTransactionInput } from "./wallet-transactions";

type AddLedgerAccountInput = Readonly<{
  readonly expected: WalletCommandIdentity;
  readonly targetChain?: Chain;
}>;

type AddLedgerAccountOutcome =
  | Readonly<{ readonly _tag: "Added" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

const makeWalletService = Effect.fn("makeWalletService")(function* () {
  const modal = yield* WalletModal;
  const persistence = yield* WidgetPersistence;
  const storageCleanup = yield* WalletStorageCleanup;
  const accountOperations = yield* makeScopedSerialOperations();
  const bootstrap = yield* bootstrapWallet;
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
  const logout = yield* Effect.cachedWithTTL(
    withContext((routing) => routing.actions.disconnect()).pipe(
      Effect.andThen(
        storageCleanup.clearOwnedStorage.pipe(Effect.ensuring(modal.closeChain))
      )
    ),
    Duration.zero
  );

  return {
    addLedgerAccount: Effect.fn("addLedgerAccount")(function* (
      input: AddLedgerAccountInput
    ): Effect.fn.Return<
      AddLedgerAccountOutcome,
      WalletIntegrationError | WalletRuntimeInvariantError
    > {
      return yield* accountOperations.run(
        Effect.gen(function* () {
          const before = yield* state.context;
          const connection = before.state.connection;
          if (
            !sameWalletCommandIdentity(
              input.expected,
              walletCommandIdentity(connection)
            ) ||
            connection.status !== "connected" ||
            !isLedgerLiveConnector(connection.connector)
          ) {
            return { _tag: "RejectedStale" } as const;
          }

          const connectorUid = connection.connector.uid;
          const outcome = yield* routeWalletLedgerAccountRequest(
            before.routing,
            input.targetChain
          );
          if (outcome._tag === "RejectedUnavailable") {
            return { _tag: "RejectedStale" } as const;
          }

          const after = yield* state.context;
          if (
            after.state.connection.status !== "connected" ||
            !isLedgerLiveConnector(after.state.connection.connector) ||
            after.state.connection.connector.uid !== connectorUid
          ) {
            return { _tag: "RejectedStale" } as const;
          }

          yield* modal.closeChain;
          return { _tag: "Added" } as const;
        })
      );
    }),
    enabledNetworks: bootstrap.snapshot.enabledNetworks,
    logout,
    signMessage: Effect.fn("signMessage")(function* (
      input: WalletSignMessageInput
    ) {
      return yield* withContext((routing) =>
        routeWalletMessage(routing, input)
      );
    }),
    signTypedData: Effect.fn("signTypedData")(function* (
      input: WalletSignTypedDataInput
    ) {
      return yield* withContext((routing) =>
        routeWalletTypedData(routing, input)
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
    make: makeWalletService(),
  }
) {
  static readonly layer = Layer.effect(WalletService, WalletService.make);

  static readonly defaultLayer = WalletService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        SolanaPlatform.layer,
        WagmiPlatform.defaultLayer,
        WalletEnvironment.layer,
        WalletStorageCleanup.layer
      )
    )
  );
}
