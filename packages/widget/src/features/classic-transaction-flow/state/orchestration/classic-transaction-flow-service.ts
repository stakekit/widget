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
import {
  toWidgetPath,
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import type { WalletRuntimeInvariantError } from "../../../../services/wallet/domain/errors";
import { walletScopeFromState } from "../../../../services/wallet/domain/scope";
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
  type RunClassicFlowCurrentOperation,
} from "./classic-flow-session";

type StartClassicTransactionFlowOutcome =
  | Readonly<{
      readonly _tag: "Started";
      readonly session: ClassicFlowSession;
    }>
  | Readonly<{ readonly _tag: "RejectedOwner" }>;

type AbandonClassicActivityResumeOutcome =
  | Readonly<{ readonly _tag: "Abandoned" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

export type AcquireClassicFlowSessionOutcome =
  | Readonly<{
      readonly _tag: "Acquired";
      readonly session: ClassicFlowSessionHandle;
    }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

type ClassicTransactionFlowServiceApi = Readonly<{
  readonly abandonActivityResume: (
    session: ClassicFlowSession
  ) => Effect.Effect<
    AbandonClassicActivityResumeOutcome,
    WidgetNavigationError
  >;
  readonly acquireSession: (
    session: ClassicFlowSession
  ) => Effect.Effect<AcquireClassicFlowSessionOutcome, never, Scope.Scope>;
  readonly currentSession: Stream.Stream<ClassicFlowSession | null>;
  readonly start: (
    input: StartClassicTransactionFlow
  ) => Effect.Effect<
    StartClassicTransactionFlowOutcome,
    WalletRuntimeInvariantError | WidgetNavigationError
  >;
}>;

const makeClassicTransactionFlowService = Effect.fn(
  "makeClassicTransactionFlowService"
)(function* () {
  const wallet = yield* WalletService;
  const navigation = yield* WidgetNavigation;
  const makeSession = yield* makeClassicFlowSessionFactory();
  const stateRef = yield* SubscriptionRef.make<ClassicFlowSession | null>(null);
  const nextEpochRef = yield* Ref.make(1);
  yield* Effect.addFinalizer(() => PubSub.shutdown(stateRef.pubsub));
  const operations = yield* makeScopedSerialOperations();

  const isCurrent = (session: ClassicFlowSession) =>
    SubscriptionRef.get(stateRef).pipe(
      Effect.map((current) => current?.epoch === session.epoch)
    );

  const clearCurrent = (session: ClassicFlowSession) =>
    SubscriptionRef.modify(stateRef, (current) =>
      current?.epoch === session.epoch ? [true, null] : [false, current]
    );

  const runCurrent =
    (session: ClassicFlowSession): RunClassicFlowCurrentOperation =>
    (operation) =>
      operations.run(
        Effect.gen(function* () {
          if (!(yield* isCurrent(session))) {
            return { _tag: "Stale" } as const;
          }
          return { _tag: "Current", value: yield* operation } as const;
        })
      );

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

    const resolved = resolveClassicTransactionFlowStart(
      input,
      currentWalletScope
    );
    const epoch = yield* Ref.getAndUpdate(nextEpochRef, (next) => next + 1);
    const session: ClassicFlowSession = { ...resolved.session, epoch };
    yield* SubscriptionRef.set(stateRef, session);

    if (resolved.navigation) {
      const rollback = clearCurrent(session).pipe(Effect.asVoid);
      yield* navigation.execute(resolved.navigation).pipe(
        Effect.tapError(() => rollback),
        Effect.onInterrupt(() => rollback)
      );
    }

    return { _tag: "Started", session } as const;
  });

  const abandonActivityResumeOpen = Effect.fn(
    "ClassicTransactionFlowService.abandonActivityResume"
  )(function* (
    session: ClassicFlowSession
  ): Effect.fn.Return<
    AbandonClassicActivityResumeOutcome,
    WidgetNavigationError
  > {
    const current = yield* SubscriptionRef.get(stateRef);
    if (
      current?.epoch !== session.epoch ||
      current.activityPresentation !== "Dashboard" ||
      current.intake._tag !== "ActivityResume"
    ) {
      return { _tag: "RejectedStale" } as const;
    }

    yield* navigation.execute({
      _tag: "Push",
      path: toWidgetPath("/activity"),
    });
    yield* clearCurrent(session);
    return { _tag: "Abandoned" } as const;
  });

  const acquireSessionOpen = Effect.fn(
    "ClassicTransactionFlowService.acquireSession"
  )(function* (
    session: ClassicFlowSession
  ): Effect.fn.Return<AcquireClassicFlowSessionOutcome, never, Scope.Scope> {
    if (!(yield* isCurrent(session))) {
      return { _tag: "RejectedStale" } as const;
    }

    const handle = yield* makeSession({
      isCurrent: isCurrent(session),
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
          if (
            !current ||
            isClassicTransactionFlowWalletScopeValid(
              current.intake,
              walletScopeFromState(state.connection)
            )
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
    abandonActivityResume: (session) =>
      operations.run(abandonActivityResumeOpen(session)),
    acquireSession: (session) => operations.run(acquireSessionOpen(session)),
    currentSession: SubscriptionRef.changes(stateRef),
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
