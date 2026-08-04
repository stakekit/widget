import {
  Context,
  Effect,
  Layer,
  PubSub,
  Ref,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { WidgetConfigService } from "../../../../services/config/widget-config";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import type { WalletRuntimeInvariantError } from "../../../../services/wallet/domain/errors";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
  walletScopeFromState,
} from "../../../../services/wallet/domain/scope";
import { WalletService } from "../../../../services/wallet/wallet-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import {
  type BorrowFlowSession,
  type BorrowTransactionFlowIntake,
  getBorrowReviewTrackingProperties,
  getBorrowTransactionFlowRoutes,
} from "../../model/borrow-transaction-flow";
import {
  type BorrowFlowSessionHandle,
  makeBorrowFlowSessionFactory,
  type RunBorrowFlowCurrentOperation,
} from "./borrow-flow-session";

type StartBorrowTransactionFlowOutcome =
  | Readonly<{ readonly _tag: "Started"; readonly session: BorrowFlowSession }>
  | Readonly<{ readonly _tag: "RejectedDisabled" }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

export type AcquireBorrowFlowSessionOutcome =
  | Readonly<{
      readonly _tag: "Acquired";
      readonly session: BorrowFlowSessionHandle;
    }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

type BorrowTransactionFlowServiceApi = Readonly<{
  readonly acquireSession: (
    session: BorrowFlowSession
  ) => Effect.Effect<AcquireBorrowFlowSessionOutcome, never, Scope.Scope>;
  readonly currentSession: Stream.Stream<BorrowFlowSession | null>;
  readonly start: (
    intake: BorrowTransactionFlowIntake
  ) => Effect.Effect<
    StartBorrowTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  >;
}>;

const copyIntake = (intake: BorrowTransactionFlowIntake) =>
  structuredClone(intake);

const makeBorrowTransactionFlowService = Effect.fn(
  "makeBorrowTransactionFlowService"
)(function* () {
  const config = yield* WidgetConfigService;
  const navigation = yield* WidgetNavigation;
  const tracking = yield* TrackingService;
  const wallet = yield* WalletService;
  const makeSession = yield* makeBorrowFlowSessionFactory();
  const stateRef = yield* SubscriptionRef.make<BorrowFlowSession | null>(null);
  const nextEpochRef = yield* Ref.make(1);
  const operations = yield* makeScopedSerialOperations();
  yield* Effect.addFinalizer(() => PubSub.shutdown(stateRef.pubsub));

  const isCurrent = (session: BorrowFlowSession) =>
    SubscriptionRef.get(stateRef).pipe(
      Effect.map((current) => current?.epoch === session.epoch)
    );

  const clearCurrent = (session: BorrowFlowSession) =>
    SubscriptionRef.modify(stateRef, (current) =>
      current?.epoch === session.epoch ? [true, null] : [false, current]
    );

  const runCurrent =
    (session: BorrowFlowSession): RunBorrowFlowCurrentOperation =>
    (operation) =>
      operations.run(
        Effect.gen(function* () {
          if (!(yield* isCurrent(session))) {
            return { _tag: "Stale" } as const;
          }
          return { _tag: "Current", value: yield* operation } as const;
        })
      );

  const commitTransition = (
    command: Parameters<typeof navigation.execute>[0]
  ) => navigation.execute(command);

  const startOpen = Effect.fn("BorrowTransactionFlowService.start")(function* (
    intake: BorrowTransactionFlowIntake
  ): Effect.fn.Return<
    StartBorrowTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  > {
    if (!(yield* config.current).borrowEnabled) {
      return { _tag: "RejectedDisabled" } as const;
    }
    const walletScope = walletScopeFromState((yield* wallet.state).connection);
    if (
      !walletScope ||
      !sameWalletScopeOwner(walletScope, {
        address: intake.command.address,
        network: intake.summary.network,
      })
    ) {
      return { _tag: "RejectedOwner" } as const;
    }

    const epoch = yield* Ref.getAndUpdate(nextEpochRef, (next) => next + 1);
    const session: BorrowFlowSession = {
      epoch,
      intake: copyIntake(intake),
      walletScope: new WalletScopeKey(walletScope),
    };
    yield* SubscriptionRef.set(stateRef, session);
    const rollback = clearCurrent(session).pipe(Effect.asVoid);
    yield* navigation
      .execute({
        _tag: "Push",
        path: getBorrowTransactionFlowRoutes(session.intake.entry).reviewPath,
      })
      .pipe(
        Effect.tapError(() => rollback),
        Effect.onInterrupt(() => rollback)
      );
    const trackingProperties = getBorrowReviewTrackingProperties(
      session.intake
    );
    if (trackingProperties) {
      yield* tracking.trackEvent("borrowReviewClicked", trackingProperties);
    }
    return { _tag: "Started", session } as const;
  });

  const acquireSessionOpen = Effect.fn(
    "BorrowTransactionFlowService.acquireSession"
  )(function* (
    session: BorrowFlowSession
  ): Effect.fn.Return<AcquireBorrowFlowSessionOutcome, never, Scope.Scope> {
    if (!(yield* isCurrent(session))) {
      return { _tag: "RejectedStale" } as const;
    }
    const handle = yield* makeSession({
      commitTransition,
      release: operations.run(clearCurrent(session)).pipe(Effect.asVoid),
      runCurrent: runCurrent(session),
      session,
    });
    return { _tag: "Acquired", session: handle } as const;
  });

  yield* wallet.states.pipe(
    Stream.runForEach((state) =>
      operations.run(
        Effect.gen(function* () {
          const current = yield* SubscriptionRef.get(stateRef);
          const walletScope = walletScopeFromState(state.connection);
          if (
            !current ||
            (walletScope &&
              sameWalletScopeOwner(walletScope, {
                address: current.intake.command.address,
                network: current.intake.summary.network,
              }))
          ) {
            return;
          }
          yield* clearCurrent(current);
        })
      )
    ),
    Effect.forkScoped({ startImmediately: true })
  );

  return {
    acquireSession: (session) => operations.run(acquireSessionOpen(session)),
    currentSession: SubscriptionRef.changes(stateRef),
    start: (intake) => operations.run(startOpen(intake)),
  } satisfies BorrowTransactionFlowServiceApi;
});

export class BorrowTransactionFlowService extends Context.Service<
  BorrowTransactionFlowService,
  BorrowTransactionFlowServiceApi
>()(
  "stakekit/widget/features/borrow-transaction-flow/BorrowTransactionFlowService"
) {
  static readonly layer = Layer.effect(
    BorrowTransactionFlowService,
    makeBorrowTransactionFlowService()
  );
}
