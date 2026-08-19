import {
  Effect,
  Exit,
  Option,
  Schema,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import type { WidgetPersistence } from "../../../persistence/widget-persistence";
import type { WalletRuntimeInvariantError } from "../../wallet-errors";
import { sameWalletScopeOwner } from "../../wallet-scope";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletCoreState,
  type WalletState,
} from "../../wallet-state";
import type { WagmiCoreObservation } from "../platform/wagmi-platform";
import type { WalletRoutingContext } from "./router";
import { makeCompleteWalletStateStream } from "./state-projection";
import type { WalletController } from "./wagmi-config";

class WalletStateInitializationError extends Schema.TaggedError<WalletStateInitializationError>()(
  "WalletStateInitializationError",
  { cause: Schema.Defect() }
) {}

export type WalletStateContext = {
  readonly core: WalletCoreState;
  readonly routing: WalletRoutingContext;
  readonly state: WalletState;
};

export type WalletStateRuntime = {
  readonly context: Effect.Effect<
    WalletStateContext,
    WalletRuntimeInvariantError
  >;
  readonly contexts: Stream.Stream<
    WalletStateContext,
    WalletRuntimeInvariantError
  >;
  readonly failInvariant: (
    error: WalletRuntimeInvariantError
  ) => Effect.Effect<void>;
};

const makeContextStream = ({
  controller,
  core,
  readStoredPublicKeys,
}: {
  readonly controller: WalletController;
  readonly core: WalletCoreState;
  readonly readStoredPublicKeys: WidgetPersistence["Service"]["readStoredPublicKeys"];
}) =>
  makeCompleteWalletStateStream({
    controller,
    projection: core,
    readStoredPublicKeys,
  }).pipe(
    Stream.map(
      ({ routing, state }): WalletStateContext => ({
        core,
        routing,
        state,
      })
    )
  );

const makeTransitionContext = ({
  controller,
  core,
}: {
  readonly controller: WalletController;
  readonly core: WalletCoreState;
}): WalletStateContext => {
  const connection: NormalizedWalletState = {
    ...disconnectedNormalizedWalletState,
    connectorChains: controller.evmConfig.evmChains,
    isLedgerLive: controller.isLedgerLive,
    status:
      core.connection.status === "disconnected" ? "disconnected" : "connecting",
  };

  return {
    core,
    routing: {
      actions: controller.actions,
      cosmosChainWallet: null,
      ledgerState: disconnectedLedgerConnectorState,
      state: connection,
    },
    state: {
      connection,
      ledger: disconnectedLedgerConnectorState,
    },
  };
};

const hasSameCommandIdentity = (
  current: WalletStateContext,
  next: WalletCoreState
): boolean => {
  const currentConnection = current.state.connection;
  const nextConnection = next.connection;
  if (
    currentConnection.status !== "connected" ||
    nextConnection.status !== "connected" ||
    !nextConnection.address ||
    !nextConnection.connector
  ) {
    return false;
  }

  return (
    currentConnection.chain.id === nextConnection.chainId &&
    currentConnection.connector.uid === nextConnection.connector.uid &&
    sameWalletScopeOwner(currentConnection, {
      address: nextConnection.address,
      network: currentConnection.network,
    })
  );
};

export const makeWalletStateRuntime = Effect.fn("makeWalletStateRuntime")(
  function* ({
    controller,
    core,
    readStoredPublicKeys,
  }: {
    readonly controller: WalletController;
    readonly core: WagmiCoreObservation;
    readonly readStoredPublicKeys: WidgetPersistence["Service"]["readStoredPublicKeys"];
  }): Effect.fn.Return<
    WalletStateRuntime,
    WalletStateInitializationError,
    Scope.Scope
  > {
    const initialCore = yield* core.current;
    const initialOption = yield* makeContextStream({
      controller,
      core: initialCore,
      readStoredPublicKeys,
    }).pipe(Stream.runHead);
    if (Option.isNone(initialOption)) {
      return yield* new WalletStateInitializationError({
        cause: new Error(
          "Wallet State stream completed before its first value"
        ),
      });
    }

    const current = yield* SubscriptionRef.make<
      Exit.Exit<WalletStateContext, WalletRuntimeInvariantError>
    >(Exit.succeed(initialOption.value));
    const contexts = SubscriptionRef.changes(current).pipe(
      Stream.mapEffect((result) => result)
    );

    yield* core.states.pipe(
      Stream.mapEffect((next) =>
        SubscriptionRef.update(current, (result) => {
          if (Exit.isFailure(result)) return result;
          if (hasSameCommandIdentity(result.value, next)) {
            return Exit.succeed({ ...result.value, core: next });
          }
          return Exit.succeed(
            makeTransitionContext({
              controller,
              core: next,
            })
          );
        }).pipe(Effect.as(next))
      ),
      Stream.switchMap((next) =>
        makeContextStream({
          controller,
          core: next,
          readStoredPublicKeys,
        })
      ),
      Stream.runForEach((context) =>
        SubscriptionRef.update(current, (result) =>
          Exit.isFailure(result) ? result : Exit.succeed(context)
        )
      ),
      Effect.forkScoped({ startImmediately: true })
    );
    const failInvariant = Effect.fn("failInvariant")(function* (
      error: WalletRuntimeInvariantError
    ) {
      yield* SubscriptionRef.update(current, (result) =>
        Exit.isFailure(result) ? result : Exit.fail(error)
      );
    });

    return {
      context: SubscriptionRef.get(current).pipe(Effect.flatten),
      contexts,
      failInvariant,
    };
  }
);
