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
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import type { WalletRuntimeInvariantError } from "../../../../services/wallet/wallet-errors";
import { walletScopeFromState } from "../../../../services/wallet/wallet-scope-adapter";
import { WalletService } from "../../../../services/wallet/wallet-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import {
  type ClassicFlowSession,
  isClassicTransactionFlowWalletScopeValid,
  resolveClassicTransactionFlowStart,
  type StartClassicTransactionFlow,
} from "../../model/classic-transaction-flow";
import {
  type ClassicFlowSessionHandle,
  makeClassicFlowSessionFactory,
} from "./classic-flow-session";

type StartClassicTransactionFlowOutcome =
  | Readonly<{
      readonly _tag: "Started";
      readonly session: ClassicFlowSession;
    }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

type ClassicTransactionFlowServiceApi = Readonly<{
  /**
   * Binds the caller's Scope to a live Session; closing it ends the Session.
   * A Session that has already ended is interrupted.
   */
  readonly acquireSession: (
    session: ClassicFlowSession
  ) => Effect.Effect<ClassicFlowSessionHandle, never, Scope.Scope>;
  readonly currentSession: Stream.Stream<ClassicFlowSession | null>;
  readonly start: (
    input: StartClassicTransactionFlow
  ) => Effect.Effect<
    StartClassicTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  >;
}>;

/** A started Session and the Scope that bounds all of its work. */
type LiveClassicFlowSession = Readonly<{
  readonly handle: ClassicFlowSessionHandle;
  readonly scope: Scope.Closeable;
  readonly session: ClassicFlowSession;
}>;

const makeClassicTransactionFlowService = Effect.fn(
  "makeClassicTransactionFlowService"
)(function* () {
  const wallet = yield* WalletService;
  const navigation = yield* WidgetNavigation;
  const makeSession = yield* makeClassicFlowSessionFactory();
  const serviceScope = yield* Effect.scope;
  const liveRef = yield* SubscriptionRef.make<LiveClassicFlowSession | null>(
    null
  );
  const nextEpochRef = yield* Ref.make(1);
  yield* Effect.addFinalizer(() => PubSub.shutdown(liveRef.pubsub));
  const operations = yield* makeScopedSerialOperations();

  // Ending a Session closes its Scope, interrupting its in-flight work.
  const end = (live: LiveClassicFlowSession) =>
    SubscriptionRef.update(liveRef, (current) =>
      current === live ? null : current
    ).pipe(Effect.andThen(Scope.close(live.scope, Exit.void)));

  const startOpen = Effect.fn("ClassicTransactionFlowService.start")(function* (
    input: StartClassicTransactionFlow
  ): Effect.fn.Return<
    StartClassicTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  > {
    const currentWalletScope = walletScopeFromState(
      (yield* wallet.state).connection
    );
    if (
      !currentWalletScope ||
      !isClassicTransactionFlowWalletScopeValid(
        input.intake,
        currentWalletScope
      )
    ) {
      return { _tag: "RejectedOwner" } as const;
    }

    const previous = yield* SubscriptionRef.get(liveRef);
    if (
      input.intake._tag === "YieldActionContinuation" &&
      previous?.session.intake._tag === "YieldActionContinuation" &&
      previous.session.intake.action.id === input.intake.action.id
    ) {
      return { _tag: "Started", session: previous.session } as const;
    }

    const resolved = resolveClassicTransactionFlowStart(
      input,
      currentWalletScope
    );
    return yield* Effect.uninterruptible(
      Effect.gen(function* () {
        if (previous) yield* Scope.close(previous.scope, Exit.void);
        const session: ClassicFlowSession = {
          ...resolved.session,
          epoch: yield* Ref.getAndUpdate(nextEpochRef, (next) => next + 1),
        };
        const scope = yield* Scope.fork(serviceScope);
        const live: LiveClassicFlowSession = {
          handle: yield* makeSession(session).pipe(Scope.provide(scope)),
          scope,
          session,
        };
        yield* SubscriptionRef.set(liveRef, live);

        if (resolved.navigation) {
          yield* navigation
            .execute(resolved.navigation)
            .pipe(Effect.tapError(() => end(live)));
        }

        return { _tag: "Started", session } as const;
      })
    );
  });

  const acquireSessionOpen = Effect.fn(
    "ClassicTransactionFlowService.acquireSession"
  )(function* (
    session: ClassicFlowSession
  ): Effect.fn.Return<ClassicFlowSessionHandle, never, Scope.Scope> {
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
          if (
            !live ||
            isClassicTransactionFlowWalletScopeValid(
              live.session.intake,
              walletScopeFromState(state.connection)
            )
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
    start: (input) => operations.run(startOpen(input)),
  } satisfies ClassicTransactionFlowServiceApi;
});

export class ClassicTransactionFlowService extends Context.Service<
  ClassicTransactionFlowService,
  ClassicTransactionFlowServiceApi
>()(
  "stakekit/widget/features/classic-transaction-flow/ClassicTransactionFlowService"
) {
  static readonly layer = Layer.effect(
    ClassicTransactionFlowService,
    makeClassicTransactionFlowService()
  );
}
