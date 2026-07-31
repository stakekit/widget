import { Effect, Ref, type Scope } from "effect";
import type { Action } from "../../../../domain/borrow/execution/action";
import type {
  WidgetNavigationCommand,
  WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import type { TransactionWorkflowInputError } from "../../../../services/workflow/transaction-workflow-model";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import {
  type BorrowFlowSession,
  type BorrowTransactionFlowOutcome,
  getBorrowTransactionFlowRoutes,
} from "../../model/borrow-transaction-flow";
import {
  type BorrowFlowExecutionHandle,
  makeBorrowFlowExecutionFactory,
} from "./borrow-flow-execution";
import {
  type BorrowActionCreationError,
  type BorrowFlowReviewHandle,
  type BorrowFlowReviewOutcome,
  makeBorrowFlowReviewFactory,
} from "./borrow-flow-review";

type BorrowFlowCurrentOperationOutcome<A> =
  | Readonly<{ readonly _tag: "Current"; readonly value: A }>
  | Readonly<{ readonly _tag: "Stale" }>;

export type RunBorrowFlowCurrentOperation = <A, E, R>(
  operation: Effect.Effect<A, E, R>
) => Effect.Effect<BorrowFlowCurrentOperationOutcome<A>, E, R>;

export type AcquireBorrowFlowExecutionOutcome =
  | Readonly<{
      readonly _tag: "Acquired";
      readonly execution: BorrowFlowExecutionHandle;
    }>
  | Readonly<{ readonly _tag: "RejectedNoReservation" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

export type BorrowFlowSessionHandle = Readonly<{
  readonly acquireExecution: () => Effect.Effect<
    AcquireBorrowFlowExecutionOutcome,
    TransactionWorkflowInputError,
    Scope.Scope
  >;
  readonly acquireReview: () => Effect.Effect<
    BorrowFlowReviewHandle,
    never,
    Scope.Scope
  >;
  readonly intake: BorrowFlowSession["intake"];
}>;

type CommitBorrowFlowTransition = (
  navigation: WidgetNavigationCommand,
  outcome: BorrowTransactionFlowOutcome | null
) => Effect.Effect<void, WidgetNavigationError>;

export const makeBorrowFlowSessionFactory = Effect.fn(
  "makeBorrowFlowSessionFactory"
)(function* () {
  const makeExecution = yield* makeBorrowFlowExecutionFactory();
  const makeReview = yield* makeBorrowFlowReviewFactory();

  return Effect.fn("makeBorrowFlowSession")(function* ({
    commitTransition,
    release,
    runCurrent,
    session,
  }: {
    readonly commitTransition: CommitBorrowFlowTransition;
    readonly release: Effect.Effect<void>;
    readonly runCurrent: RunBorrowFlowCurrentOperation;
    readonly session: BorrowFlowSession;
  }): Effect.fn.Return<BorrowFlowSessionHandle, never, Scope.Scope> {
    const executionActionRef = yield* Ref.make<Action | null>(null);
    const operations = yield* makeScopedSerialOperations();
    const paths = getBorrowTransactionFlowRoutes(session.intake.entry);

    const back = () =>
      runCurrent(
        commitTransition({ _tag: "Replace", path: paths.basePath }, null)
      ).pipe(
        Effect.map((result) =>
          result._tag === "Current"
            ? ({ _tag: "Accepted" } as const)
            : ({ _tag: "RejectedStale" } as const)
        )
      );

    const confirmAction = (
      createAction: Effect.Effect<Action, BorrowActionCreationError>
    ): Effect.Effect<
      BorrowFlowReviewOutcome,
      BorrowActionCreationError | WidgetNavigationError
    > =>
      operations.run(
        runCurrent(
          Effect.gen(function* () {
            if ((yield* Ref.get(executionActionRef)) !== null) {
              return { _tag: "RejectedAlreadyReserved" } as const;
            }

            const action = yield* createAction;
            yield* Ref.set(executionActionRef, action);
            const rollback = Ref.modify(executionActionRef, (reserved) =>
              reserved === action ? [undefined, null] : [undefined, reserved]
            );
            yield* commitTransition(
              { _tag: "Push", path: paths.stepsPath },
              {
                _tag: "ExecutionStarted",
                entry: session.intake.entry,
                epoch: session.epoch,
              }
            ).pipe(
              Effect.tapError(() => rollback),
              Effect.onInterrupt(() => rollback)
            );
            return { _tag: "Confirmed" } as const;
          })
        ).pipe(
          Effect.map((result) =>
            result._tag === "Current"
              ? result.value
              : ({ _tag: "RejectedStale" } as const)
          )
        )
      );

    const runExecutionOperation =
      (action: Action) =>
      <A, E>(
        operation: () => Effect.Effect<A, E>
      ): Effect.Effect<
        | Readonly<{ readonly _tag: "Accepted"; readonly value: A }>
        | Readonly<{ readonly _tag: "RejectedStale" }>,
        E
      > =>
        operations.run(
          Effect.gen(function* (): Effect.fn.Return<
            | Readonly<{ readonly _tag: "Accepted"; readonly value: A }>
            | Readonly<{ readonly _tag: "RejectedStale" }>,
            E
          > {
            if ((yield* Ref.get(executionActionRef)) !== action) {
              return { _tag: "RejectedStale" } as const;
            }
            const result = yield* runCurrent(Effect.suspend(operation));
            return result._tag === "Current"
              ? ({ _tag: "Accepted", value: result.value } as const)
              : ({ _tag: "RejectedStale" } as const);
          })
        );

    const acquireReview = () =>
      operations.run(
        runCurrent(Ref.set(executionActionRef, null)).pipe(
          Effect.andThen(
            makeReview({
              back,
              command: session.intake.command,
              confirmAction,
            })
          )
        )
      );

    const acquireExecution = Effect.fn("BorrowFlowSession.acquireExecution")(
      function* (): Effect.fn.Return<
        AcquireBorrowFlowExecutionOutcome,
        TransactionWorkflowInputError,
        Scope.Scope
      > {
        const current = yield* runCurrent(
          Effect.gen(function* () {
            const action = yield* Ref.get(executionActionRef);
            if (!action) {
              return { _tag: "RejectedNoReservation" } as const;
            }
            const execution = yield* makeExecution({
              action,
              commitTransition,
              doneOutcome: {
                _tag: "Done",
                entry: session.intake.entry,
                epoch: session.epoch,
              },
              intake: session.intake,
              runOperation: runExecutionOperation(action),
              walletScope: session.walletScope,
            });
            return { _tag: "Acquired", execution } as const;
          })
        );
        return current._tag === "Current"
          ? current.value
          : ({ _tag: "RejectedStale" } as const);
      }
    );

    yield* Effect.addFinalizer(() => release.pipe(Effect.ignore));

    return {
      acquireExecution: () => operations.run(acquireExecution()),
      acquireReview,
      intake: session.intake,
    };
  });
});
