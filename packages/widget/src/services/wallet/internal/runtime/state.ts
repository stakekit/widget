import {
  Effect,
  Option,
  Result,
  Schema,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { sameWalletScopeOwner } from "../../../../domain/wallet/wallet-scope";
import type { WidgetPersistence } from "../../../persistence/widget-persistence";
import type { WalletRuntimeInvariantError } from "../../wallet-errors";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
  type WalletCoreState,
  type WalletState,
} from "../../wallet-state";
import type { WagmiCoreObservation } from "../platform/wagmi-platform";
import type { WalletRoutingContext } from "./router";
import {
  makeCompleteWalletStateStream,
  transitionalWalletState,
} from "./state-projection";
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
  previous,
  readStoredPublicKeys,
}: {
  readonly controller: WalletController;
  readonly core: WalletCoreState;
  readonly previous?: WalletState["connection"];
  readonly readStoredPublicKeys: WidgetPersistence["Service"]["readStoredPublicKeys"];
}) =>
  makeCompleteWalletStateStream({
    controller,
    previous,
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
  current,
  core,
}: {
  readonly controller: WalletController;
  readonly current: WalletStateContext;
  readonly core: WalletCoreState;
}): WalletStateContext => {
  const connection = transitionalWalletState({
    additionalAddresses: null,
    connection: core.connection,
    connectorChains: controller.evmConfig.evmChains,
    controller,
    forceAddress: undefined,
    ledgerState: disconnectedLedgerConnectorState,
    previous: current.state.connection,
  });

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
      Result.Result<WalletStateContext, WalletRuntimeInvariantError>
    >(Result.succeed(initialOption.value));
    const contexts = SubscriptionRef.changes(current).pipe(
      Stream.mapEffect(Effect.fromResult)
    );

    yield* core.states.pipe(
      Stream.mapEffect((next) =>
        SubscriptionRef.modify(
          current,
          (
            result
          ): readonly [
            {
              readonly next: WalletCoreState;
              readonly previous: NormalizedWalletState | undefined;
            },
            Result.Result<WalletStateContext, WalletRuntimeInvariantError>,
          ] => {
            if (Result.isFailure(result)) {
              return [{ next, previous: undefined }, result];
            }
            const context = hasSameCommandIdentity(result.success, next)
              ? { ...result.success, core: next }
              : makeTransitionContext({
                  controller,
                  core: next,
                  current: result.success,
                });
            return [
              { next, previous: context.state.connection },
              Result.succeed(context),
            ];
          }
        )
      ),
      Stream.switchMap(({ next, previous }) =>
        makeContextStream({
          controller,
          core: next,
          previous,
          readStoredPublicKeys,
        })
      ),
      Stream.runForEach((context) =>
        SubscriptionRef.update(current, (result) =>
          Result.isFailure(result) ? result : Result.succeed(context)
        )
      ),
      Effect.forkScoped({ startImmediately: true })
    );
    const failInvariant = Effect.fn("failInvariant")(function* (
      error: WalletRuntimeInvariantError
    ) {
      yield* SubscriptionRef.update(current, (result) =>
        Result.isFailure(result) ? result : Result.fail(error)
      );
    });

    return {
      context: SubscriptionRef.get(current).pipe(
        Effect.flatMap(Effect.fromResult)
      ),
      contexts,
      failInvariant,
    };
  }
);
