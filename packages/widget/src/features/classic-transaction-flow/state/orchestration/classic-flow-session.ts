import { Effect, Ref, type Scope, type Stream } from "effect";
import type { YieldAction } from "../../../../domain/action/models";
import type { WidgetNavigationError } from "../../../../services/navigation/widget-navigation";
import { WidgetNavigation } from "../../../../services/navigation/widget-navigation";
import type { TransactionWorkflowInputError } from "../../../../services/transaction-workflow/transaction-workflow-model";
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
  | Readonly<{ readonly _tag: "RejectedExpired" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

type ClassicFlowCurrentOperationOutcome<A> =
  | Readonly<{ readonly _tag: "Current"; readonly value: A }>
  | Readonly<{ readonly _tag: "Stale" }>;

export type RunClassicFlowCurrentOperation = <A, E, R>(
  operation: Effect.Effect<A, E, R>
) => Effect.Effect<ClassicFlowCurrentOperationOutcome<A>, E, R>;

type AcquireClassicFlowExecutionOutcome =
  | Readonly<{
      readonly _tag: "Acquired";
      readonly execution: ClassicFlowExecutionHandle;
    }>
  | Readonly<{ readonly _tag: "RejectedNoReservation" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

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

export const makeClassicFlowSessionFactory = Effect.fn(
  "makeClassicFlowSessionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const makeExecution = yield* makeClassicFlowExecutionFactory();
  const makeReview = yield* makeClassicFlowReviewFactory();

  return Effect.fn("makeClassicFlowSession")(function* ({
    isCurrent,
    release,
    runCurrent,
    session,
  }: {
    readonly isCurrent: Effect.Effect<boolean>;
    readonly release: Effect.Effect<void>;
    readonly runCurrent: RunClassicFlowCurrentOperation;
    readonly session: ClassicFlowSession;
  }): Effect.fn.Return<ClassicFlowSessionHandle, never, Scope.Scope> {
    const executionActionRef = yield* Ref.make<YieldAction | null>(null);
    const operations = yield* makeScopedSerialOperations();

    const runExecutionOperation =
      (action: YieldAction) =>
      <E>(
        operation: () => Effect.Effect<void, E>
      ): Effect.Effect<
        | Readonly<{ readonly _tag: "Accepted" }>
        | Readonly<{ readonly _tag: "RejectedStale" }>,
        E
      > =>
        operations.run(
          Ref.get(executionActionRef).pipe(
            Effect.flatMap((reserved) =>
              reserved !== action
                ? Effect.succeed({ _tag: "RejectedStale" } as const)
                : runCurrent(Effect.suspend(operation)).pipe(
                    Effect.map((result) =>
                      result._tag === "Current"
                        ? ({ _tag: "Accepted" } as const)
                        : ({ _tag: "RejectedStale" } as const)
                    )
                  )
            )
          )
        );

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
      const current = yield* runCurrent(
        Effect.gen(function* () {
          const latestEligibility = yield* eligibility;
          if (latestEligibility.kycBlocking) {
            return { _tag: "RejectedBlocked" } as const;
          }
          if (latestEligibility.activityExpired) {
            return { _tag: "RejectedExpired" } as const;
          }
          if ((yield* Ref.get(executionActionRef)) !== null) {
            return { _tag: "RejectedAlreadyReserved" } as const;
          }

          yield* Effect.uninterruptible(
            Effect.gen(function* () {
              yield* Ref.set(executionActionRef, action);
              const rollback = Ref.modify(executionActionRef, (reserved) =>
                reserved === action ? [undefined, null] : [undefined, reserved]
              );
              yield* Effect.all(
                [
                  navigation.execute({
                    _tag: "Push",
                    path: session.destination.stepsPath,
                  }),
                  afterReservation,
                ],
                { concurrency: "unbounded", discard: true }
              ).pipe(Effect.tapError(() => rollback));
            })
          );
          return { _tag: "Promoted" } as const;
        })
      );
      return current._tag === "Current"
        ? current.value
        : ({ _tag: "RejectedStale" } as const);
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
        Ref.set(executionActionRef, null).pipe(
          Effect.andThen(
            makeReview({
              eligibilityStates,
              intake: session.intake,
              isCurrent,
              promoteToExecution,
            })
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
      const current = yield* runCurrent(
        Effect.gen(function* () {
          const action = yield* Ref.get(executionActionRef);
          if (!action) {
            return { _tag: "RejectedNoReservation" } as const;
          }

          const execution = yield* makeExecution({
            action,
            intake: session.intake,
            paths: session.destination,
            runOperation: runExecutionOperation(action),
          });
          return { _tag: "Acquired", execution } as const;
        })
      );
      return current._tag === "Current"
        ? current.value
        : ({ _tag: "RejectedStale" } as const);
    });

    yield* Effect.addFinalizer(() => release.pipe(Effect.ignore));

    return {
      acquireExecution: () => operations.run(acquireExecutionOpen()),
      acquireReview,
      intake: session.intake,
    };
  });
});
