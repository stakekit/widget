import {
  Context,
  Effect,
  Equal,
  Exit,
  Layer,
  PubSub,
  Ref,
  Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import {
  sameWalletScopeOwner,
  WalletScopeKey,
} from "../../../../domain/wallet/wallet-scope";
import { WidgetConfigService } from "../../../../services/config/widget-config";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import { TrackingService } from "../../../../services/tracking/tracking-service";
import type { WalletRuntimeInvariantError } from "../../../../services/wallet/wallet-errors";
import { walletScopeFromState } from "../../../../services/wallet/wallet-scope-adapter";
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
} from "./borrow-flow-session";

type StartBorrowTransactionFlowOutcome =
  | Readonly<{ readonly _tag: "Started"; readonly session: BorrowFlowSession }>
  | Readonly<{ readonly _tag: "RejectedDisabled" }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

type BorrowTransactionFlowServiceApi = Readonly<{
  /**
   * Binds the caller's Scope to a live Session; closing it ends the Session.
   * A Session that has already ended is interrupted.
   */
  readonly acquireSession: (
    session: BorrowFlowSession
  ) => Effect.Effect<BorrowFlowSessionHandle, never, Scope.Scope>;
  readonly currentSession: Stream.Stream<BorrowFlowSession | null>;
  readonly start: (
    intake: BorrowTransactionFlowIntake
  ) => Effect.Effect<
    StartBorrowTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  >;
}>;

/** A started Session and the Scope that bounds all of its work. */
type LiveBorrowFlowSession = Readonly<{
  readonly handle: BorrowFlowSessionHandle;
  readonly scope: Scope.Closeable;
  readonly session: BorrowFlowSession;
}>;

const makeBorrowTransactionFlowService = Effect.fn(
  "makeBorrowTransactionFlowService"
)(function* () {
  const config = yield* WidgetConfigService;
  const navigation = yield* WidgetNavigation;
  const tracking = yield* TrackingService;
  const wallet = yield* WalletService;
  const makeSession = yield* makeBorrowFlowSessionFactory();
  const serviceScope = yield* Effect.scope;
  const liveRef = yield* SubscriptionRef.make<LiveBorrowFlowSession | null>(
    null
  );
  const nextEpochRef = yield* Ref.make(1);
  const operations = yield* makeScopedSerialOperations();
  yield* Effect.addFinalizer(() => PubSub.shutdown(liveRef.pubsub));

  // Ending a Session closes its Scope, interrupting its in-flight work.
  const end = (live: LiveBorrowFlowSession) =>
    SubscriptionRef.update(liveRef, (current) =>
      current === live ? null : current
    ).pipe(Effect.andThen(Scope.close(live.scope, Exit.void)));

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

    const session = yield* Effect.uninterruptible(
      Effect.gen(function* () {
        const previous = yield* SubscriptionRef.get(liveRef);
        if (previous) yield* Scope.close(previous.scope, Exit.void);
        const session: BorrowFlowSession = {
          epoch: yield* Ref.getAndUpdate(nextEpochRef, (next) => next + 1),
          intake: { ...intake },
          walletScope: new WalletScopeKey(walletScope),
        };
        const scope = yield* Scope.fork(serviceScope);
        const live: LiveBorrowFlowSession = {
          handle: yield* makeSession(session).pipe(Scope.provide(scope)),
          scope,
          session,
        };
        yield* SubscriptionRef.set(liveRef, live);
        yield* navigation
          .execute({
            _tag: "Push",
            path: getBorrowTransactionFlowRoutes(session.intake.entry)
              .reviewPath,
          })
          .pipe(Effect.tapError(() => end(live)));
        return session;
      })
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
  ): Effect.fn.Return<BorrowFlowSessionHandle, never, Scope.Scope> {
    const live = yield* SubscriptionRef.get(liveRef);
    // Route Atom families key Sessions structurally, so admission does too.
    if (!live || !Equal.equals(live.session, session)) {
      return yield* Effect.interrupt;
    }
    yield* Effect.addFinalizer(() =>
      operations.run(end(live)).pipe(Effect.ignore)
    );
    return live.handle;
  });

  yield* wallet.states.pipe(
    Stream.runForEach((state) =>
      operations.run(
        Effect.gen(function* () {
          const live = yield* SubscriptionRef.get(liveRef);
          const walletScope = walletScopeFromState(state.connection);
          if (
            !live ||
            (walletScope &&
              sameWalletScopeOwner(walletScope, {
                address: live.session.intake.command.address,
                network: live.session.intake.summary.network,
              }))
          ) {
            return;
          }
          yield* end(live);
        })
      )
    ),
    Effect.forkScoped({ startImmediately: true })
  );

  return {
    acquireSession: (session) => operations.run(acquireSessionOpen(session)),
    currentSession: SubscriptionRef.changes(liveRef).pipe(
      Stream.map((live) => live?.session ?? null)
    ),
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
