import { Effect, type Scope, ScopedRef } from "effect";
import type { Action } from "../../../../domain/borrow/execution/action";
import { WidgetNavigation } from "../../../../services/navigation/widget-navigation";
import type { TransactionWorkflowInputError } from "../../../../services/transaction-workflow/transaction-workflow-model";
import { acquireInChildScope } from "../../../../shared/effect/child-scope";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import {
  type BorrowFlowSession,
  getBorrowTransactionFlowRoutes,
} from "../../model/borrow-transaction-flow";
import {
  type BorrowFlowExecutionHandle,
  makeBorrowFlowExecutionFactory,
} from "./borrow-flow-execution";
import {
  type BorrowActionCreationError,
  type BorrowFlowReviewHandle,
  makeBorrowFlowReviewFactory,
} from "./borrow-flow-review";

export type AcquireBorrowFlowExecutionOutcome =
  | Readonly<{
      readonly _tag: "Acquired";
      readonly execution: BorrowFlowExecutionHandle;
    }>
  | Readonly<{ readonly _tag: "RejectedNoReservation" }>;

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

/** The reserved action and the Scope its Execution lives in. */
type BorrowFlowReservation = Readonly<{
  readonly action: Action;
  readonly scope: Scope.Scope;
}>;

export const makeBorrowFlowSessionFactory = Effect.fn(
  "makeBorrowFlowSessionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const makeExecution = yield* makeBorrowFlowExecutionFactory();
  const makeReview = yield* makeBorrowFlowReviewFactory();

  /**
   * Builds the Session's operations in the provided Session Scope. Closing that
   * Scope interrupts every Session, Review, and Execution operation in flight
   * and rejects later ones by interruption.
   */
  return Effect.fn("makeBorrowFlowSession")(function* (
    session: BorrowFlowSession
  ): Effect.fn.Return<BorrowFlowSessionHandle, never, Scope.Scope> {
    const sessionScope = yield* Effect.scope;
    const operations = yield* makeScopedSerialOperations();
    // Replacing the reservation closes the previous one's Scope, which ends
    // any Execution acquired for it.
    const reservation = yield* ScopedRef.make<BorrowFlowReservation | null>(
      () => null
    );
    const releaseReservation = ScopedRef.set(reservation, Effect.succeed(null));
    const paths = getBorrowTransactionFlowRoutes(session.intake.entry);

    const confirmAction = (
      createAction: Effect.Effect<Action, BorrowActionCreationError>
    ) =>
      operations.run(
        Effect.gen(function* () {
          if ((yield* ScopedRef.get(reservation)) !== null) {
            return { _tag: "RejectedAlreadyReserved" } as const;
          }

          const action = yield* createAction;
          yield* Effect.uninterruptible(
            ScopedRef.set(
              reservation,
              Effect.map(Effect.scope, (scope) => ({ action, scope }))
            ).pipe(
              Effect.andThen(
                navigation.execute({ _tag: "Push", path: paths.stepsPath })
              ),
              Effect.tapError(() => releaseReservation)
            )
          );
          return { _tag: "Confirmed" } as const;
        })
      );

    const acquireReview = () =>
      operations.run(
        releaseReservation.pipe(
          Effect.andThen(
            acquireInChildScope(
              sessionScope,
              makeReview({
                back: Effect.uninterruptible(
                  navigation.execute({ _tag: "Replace", path: paths.basePath })
                ),
                command: session.intake.command,
                confirmAction,
              })
            )
          )
        )
      );

    const acquireExecution = Effect.fn("BorrowFlowSession.acquireExecution")(
      function* (): Effect.fn.Return<
        AcquireBorrowFlowExecutionOutcome,
        TransactionWorkflowInputError,
        Scope.Scope
      > {
        const reserved = yield* ScopedRef.get(reservation);
        if (!reserved) return { _tag: "RejectedNoReservation" } as const;
        const execution = yield* acquireInChildScope(
          reserved.scope,
          makeExecution({
            action: reserved.action,
            intake: session.intake,
            walletScope: session.walletScope,
          })
        );
        return { _tag: "Acquired", execution } as const;
      }
    );

    return {
      acquireExecution: () => operations.run(acquireExecution()),
      acquireReview,
      intake: session.intake,
    };
  });
});
