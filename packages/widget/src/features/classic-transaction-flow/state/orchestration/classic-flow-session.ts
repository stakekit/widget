import { Effect, type Scope, ScopedRef, type Stream } from "effect";
import type { YieldAction } from "../../../../domain/action/models";
import type { WidgetNavigationError } from "../../../../services/navigation/widget-navigation";
import { WidgetNavigation } from "../../../../services/navigation/widget-navigation";
import type { TransactionWorkflowInputError } from "../../../../services/transaction-workflow/transaction-workflow-model";
import { acquireInChildScope } from "../../../../shared/effect/child-scope";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import type {
  ClassicFlowSession,
  ClassicTransactionFlowIntake,
} from "../../model/classic-transaction-flow";
import {
  type ClassicFlowExecutionHandle,
  makeClassicFlowExecutionFactory,
} from "./classic-flow-execution";
import {
  type ClassicFlowReviewEligibility,
  type ClassicFlowReviewHandle,
  makeClassicFlowReviewFactory,
} from "./classic-flow-review";

type PromoteToExecutionOutcome =
  | Readonly<{ readonly _tag: "Promoted" }>
  | Readonly<{ readonly _tag: "RejectedAlreadyReserved" }>
  | Readonly<{ readonly _tag: "RejectedBlocked" }>
  | Readonly<{ readonly _tag: "RejectedExpired" }>;

type AcquireClassicFlowExecutionOutcome =
  | Readonly<{
      readonly _tag: "Acquired";
      readonly execution: ClassicFlowExecutionHandle;
    }>
  | Readonly<{ readonly _tag: "RejectedNoReservation" }>;

export type ClassicFlowSessionHandle = Readonly<{
  readonly acquireExecution: () => Effect.Effect<
    AcquireClassicFlowExecutionOutcome,
    TransactionWorkflowInputError,
    Scope.Scope
  >;
  readonly acquireReview: (
    eligibilityStates: Stream.Stream<ClassicFlowReviewEligibility>
  ) => Effect.Effect<ClassicFlowReviewHandle, never, Scope.Scope>;
  readonly intake: ClassicTransactionFlowIntake;
}>;

/** The reserved action and the Scope its Execution lives in. */
type ClassicFlowReservation = Readonly<{
  readonly action: YieldAction;
  readonly scope: Scope.Scope;
}>;

export const makeClassicFlowSessionFactory = Effect.fn(
  "makeClassicFlowSessionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const makeExecution = yield* makeClassicFlowExecutionFactory();
  const makeReview = yield* makeClassicFlowReviewFactory();

  /**
   * Builds the Session's operations in the provided Session Scope. Closing that
   * Scope interrupts every Session, Review, and Execution operation in flight
   * and rejects later ones by interruption.
   */
  return Effect.fn("makeClassicFlowSession")(function* (
    session: ClassicFlowSession
  ): Effect.fn.Return<ClassicFlowSessionHandle, never, Scope.Scope> {
    const sessionScope = yield* Effect.scope;
    const operations = yield* makeScopedSerialOperations();
    // Replacing the reservation closes the previous one's Scope, which ends
    // any Execution acquired for it.
    const reservation = yield* ScopedRef.make<ClassicFlowReservation | null>(
      () => null
    );
    const releaseReservation = ScopedRef.set(reservation, Effect.succeed(null));

    const promoteToExecutionOpen = Effect.fn(
      "ClassicFlowSession.promoteToExecution"
    )(function* ({
      action,
      afterReservation,
      eligibility,
    }: {
      readonly action: YieldAction;
      readonly afterReservation: Effect.Effect<void>;
      readonly eligibility: Effect.Effect<ClassicFlowReviewEligibility>;
    }): Effect.fn.Return<PromoteToExecutionOutcome, WidgetNavigationError> {
      const latestEligibility = yield* eligibility;
      if (latestEligibility.kycBlocking) {
        return { _tag: "RejectedBlocked" } as const;
      }
      if (latestEligibility.activityExpired) {
        return { _tag: "RejectedExpired" } as const;
      }
      if ((yield* ScopedRef.get(reservation)) !== null) {
        return { _tag: "RejectedAlreadyReserved" } as const;
      }

      yield* Effect.uninterruptible(
        ScopedRef.set(
          reservation,
          Effect.map(Effect.scope, (scope) => ({ action, scope }))
        ).pipe(
          Effect.andThen(
            Effect.all(
              [
                navigation.execute({
                  _tag: "Push",
                  path: session.destination.stepsPath,
                }),
                afterReservation,
              ],
              { concurrency: "unbounded", discard: true }
            )
          ),
          Effect.tapError(() => releaseReservation)
        )
      );
      return { _tag: "Promoted" } as const;
    });

    const promoteToExecution = (
      action: YieldAction,
      afterReservation: Effect.Effect<void>,
      eligibility: Effect.Effect<ClassicFlowReviewEligibility>
    ) =>
      operations.run(
        promoteToExecutionOpen({ action, afterReservation, eligibility })
      );

    const acquireReview = (
      eligibilityStates: Stream.Stream<ClassicFlowReviewEligibility>
    ) =>
      operations.run(
        releaseReservation.pipe(
          Effect.andThen(
            acquireInChildScope(
              sessionScope,
              makeReview({
                eligibilityStates,
                intake: session.intake,
                promoteToExecution,
              })
            )
          )
        )
      );

    const acquireExecutionOpen = Effect.fn(
      "ClassicFlowSession.acquireExecution"
    )(function* (): Effect.fn.Return<
      AcquireClassicFlowExecutionOutcome,
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
          paths: session.destination,
        })
      );
      return { _tag: "Acquired", execution } as const;
    });

    return {
      acquireExecution: () => operations.run(acquireExecutionOpen()),
      acquireReview,
      intake: session.intake,
    };
  });
});
