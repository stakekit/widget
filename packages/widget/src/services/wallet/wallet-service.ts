import {
  Context,
  Duration,
  Effect,
  Layer,
  Option,
  Stream,
  SubscriptionRef,
} from "effect";
import { makeScopedSerialOperations } from "../../shared/effect/scoped-serial-operations";
import { WidgetPersistence } from "../persistence/widget-persistence";
import { isLedgerLiveConnector } from "./internal/adapters/ledger/ledger-live-connector-meta";
import { SolanaPlatform } from "./internal/platform/solana-platform";
import { WagmiPlatform } from "./internal/platform/wagmi-platform";
import { WalletConnectPresentationPlatform } from "./internal/platform/wallet-connect-presentation";
import { WalletConnectProtocolPlatform } from "./internal/platform/wallet-connect-protocol";
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
import { isWalletCancellation } from "./wallet-cancellation";
import {
  sameWalletCommandIdentity,
  type WalletCommandIdentity,
  walletCommandIdentity,
} from "./wallet-command-identity";
import type {
  WalletConnectInput,
  WalletSignMessageInput,
  WalletSignTypedDataInput,
  WalletSwitchAccountInput,
  WalletSwitchChainInput,
} from "./wallet-commands";
import {
  type Chain,
  type ConnectorWithWalletDetails,
  walletAvailabilityKey,
} from "./wallet-descriptors";
import {
  type WalletIntegrationError,
  WalletNotAvailableError,
  type WalletRuntimeInvariantError,
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

/** Picker outcome of a failed connect: dismissal, missing wallet or failure. */
const connectionFailure = (cause: unknown) => {
  if (isWalletCancellation(cause)) return "Idle";
  if (cause instanceof WalletNotAvailableError) return "WalletNotAvailable";
  return "Failed";
};

const makeWalletService = Effect.fn("makeWalletService")(function* () {
  const modal = yield* WalletModal;
  const persistence = yield* WidgetPersistence;
  const storageCleanup = yield* WalletStorageCleanup;
  const accountOperations = yield* makeScopedSerialOperations();
  const connectionOperations = yield* makeScopedSerialOperations();
  const connectionAttempt = yield* SubscriptionRef.make<
    Readonly<{
      /** `WalletNotAvailable`: the wallet's injected provider was missing. */
      readonly _tag: "Idle" | "Pending" | "Failed" | "WalletNotAvailable";
      readonly revision?: number;
    }>
  >({ _tag: "Idle" });
  const currentConnectionAttempt = Effect.gen(function* () {
    const attempt = yield* SubscriptionRef.get(connectionAttempt);
    const revision = yield* modal.connectOpen.revision;
    return {
      _tag: attempt.revision !== revision ? "Idle" : attempt._tag,
    } as const;
  });
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

  const connectors = state.contexts.pipe(
    Stream.map((context) => context.core.connectors),
    Stream.changesWith((left, right) => left === right)
  );
  /** Latest settled detection per injected wallet, by `walletAvailabilityKey`; lives as long as the wallet runtime. */
  const availability = yield* SubscriptionRef.make<
    ReadonlyMap<string, boolean>
  >(new Map());
  const detectionRequests = yield* SubscriptionRef.make(0);
  // Injected wallets are detected in the background as soon as connectors
  // exist, again when they change and whenever the picker asks. A new run
  // replaces the one in flight, so probes that never settle do not pile up.
  yield* Stream.zipLatest(
    connectors,
    SubscriptionRef.changes(detectionRequests)
  ).pipe(
    Stream.switchMap(([current]) =>
      Stream.fromEffect(
        Effect.forEach(
          current,
          (connector: ConnectorWithWalletDetails) => {
            const details = connector.walletDetails;
            const detection = details?.availability;
            if (!details || detection?._tag !== "Injected") return Effect.void;
            const key = walletAvailabilityKey(details);
            return detection.detect.pipe(
              Effect.flatMap((detected) =>
                SubscriptionRef.updateSome(availability, (results) =>
                  results.get(key) === detected
                    ? Option.none()
                    : Option.some(new Map(results).set(key, detected))
                )
              )
            );
          },
          { concurrency: "unbounded", discard: true }
        )
      )
    ),
    Stream.runDrain,
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
    connect: Effect.fn("connect")(function* (input: WalletConnectInput) {
      const revision = yield* modal.connectOpen.revision;
      const previous = yield* SubscriptionRef.get(connectionAttempt);
      if (previous._tag === "Pending" && previous.revision === revision) return;

      const attempt = { _tag: "Pending", revision } as const;
      yield* SubscriptionRef.set(connectionAttempt, attempt);
      const isCurrent = Effect.gen(function* () {
        return (
          (yield* SubscriptionRef.get(connectionAttempt)) === attempt &&
          (yield* modal.connectOpen.revision) === revision
        );
      });
      const cancelled = modal.connectOpen.changes.pipe(
        Stream.filterEffect(() =>
          modal.connectOpen.revision.pipe(
            Effect.map((current) => current !== revision)
          )
        ),
        Stream.runHead,
        Effect.asVoid
      );

      yield* connectionOperations.run(
        Effect.gen(function* () {
          if (!(yield* isCurrent)) return;
          yield* bootstrap.controller.actions
            .connect({ ...input, isCurrent })
            .pipe(
              Effect.matchEffect({
                onFailure: (error) =>
                  Effect.gen(function* () {
                    if (!(yield* isCurrent)) return;
                    yield* SubscriptionRef.set(connectionAttempt, {
                      _tag: connectionFailure(error.cause),
                      revision,
                    });
                  }),
                onSuccess: () =>
                  Effect.gen(function* () {
                    if (!(yield* isCurrent)) return;
                    yield* SubscriptionRef.set(connectionAttempt, {
                      _tag: "Idle",
                      revision,
                    });
                    yield* modal.connectOpen.set(false);
                  }),
              }),
              Effect.raceFirst(cancelled)
            );
        }).pipe(
          Effect.ensuring(
            SubscriptionRef.update(connectionAttempt, (current) =>
              current === attempt
                ? { _tag: "Idle" as const, revision }
                : current
            )
          )
        )
      );
    }),
    connectionAttempt: currentConnectionAttempt,
    /** Wallet connectors as they are added and replaced. */
    connectors,
    /** Latest settled detection per injected wallet, by `walletAvailabilityKey`, as results change. */
    availability: SubscriptionRef.changes(availability),
    /** Detects every injected wallet again, replacing a detection run in flight. */
    detectAvailability: SubscriptionRef.update(
      detectionRequests,
      (count) => count + 1
    ),
    connectionAttempts: Stream.merge(
      SubscriptionRef.changes(connectionAttempt),
      modal.connectOpen.changes
    ).pipe(Stream.mapEffect(() => currentConnectionAttempt)),
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
    switchChain: Effect.fn("switchChain")(function* (
      input: WalletSwitchChainInput
    ) {
      return yield* withContext((routing) =>
        routing.actions.switchChain(input)
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
      ).pipe(
        Layer.provide(
          WalletConnectProtocolPlatform.layer.pipe(
            Layer.provideMerge(WalletConnectPresentationPlatform.layer)
          )
        )
      )
    )
  );
}
