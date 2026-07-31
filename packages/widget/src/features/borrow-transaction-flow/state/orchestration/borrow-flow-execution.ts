import { Duration, Effect, Option, Schedule, type Scope, Stream } from "effect";
import type { Action } from "../../../../domain/borrow/execution/action";
import {
  WidgetNavigation,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import {
  BorrowTransactionWorkflowInput,
  type TransactionWorkflowCommand,
  type TransactionWorkflowInputError,
  type TransactionWorkflowState,
} from "../../../../services/workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../../services/workflow/transaction-workflow-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import type {
  BorrowTransactionFlowIntake,
  BorrowTransactionFlowOutcome,
} from "../../model/borrow-transaction-flow";
import { getBorrowTransactionFlowRoutes } from "../../model/borrow-transaction-flow";

type BorrowFlowExecutionOutcome =
  | Readonly<{ readonly _tag: "Accepted" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

type BorrowFlowFinishOutcome =
  | BorrowFlowExecutionOutcome
  | Readonly<{ readonly _tag: "RejectedNotCompleted" }>;

export type BorrowFlowExecutionHandle = Readonly<{
  readonly back: () => Effect.Effect<
    BorrowFlowExecutionOutcome,
    WidgetNavigationError
  >;
  readonly finish: () => Effect.Effect<
    BorrowFlowFinishOutcome,
    WidgetNavigationError
  >;
  readonly runWorkflow: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<BorrowFlowExecutionOutcome>;
  readonly states: Stream.Stream<TransactionWorkflowState>;
}>;

type RunBorrowFlowExecutionOperation = <A, E>(
  operation: () => Effect.Effect<A, E>
) => Effect.Effect<
  | Readonly<{ readonly _tag: "Accepted"; readonly value: A }>
  | Readonly<{ readonly _tag: "RejectedStale" }>,
  E
>;

type CommitBorrowFlowTransition = (
  navigation: Parameters<WidgetNavigation["Service"]["execute"]>[0],
  outcome: BorrowTransactionFlowOutcome | null
) => Effect.Effect<void, WidgetNavigationError>;

export const makeBorrowFlowExecutionFactory = Effect.fn(
  "makeBorrowFlowExecutionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const transactionWorkflow = yield* TransactionWorkflowService;

  return Effect.fn("makeBorrowFlowExecution")(function* ({
    action,
    commitTransition,
    doneOutcome,
    intake,
    runOperation,
    walletScope,
  }: {
    readonly action: Action;
    readonly commitTransition: CommitBorrowFlowTransition;
    readonly doneOutcome: BorrowTransactionFlowOutcome;
    readonly intake: BorrowTransactionFlowIntake;
    readonly runOperation: RunBorrowFlowExecutionOperation;
    readonly walletScope: import("../../../../services/wallet/domain/scope").WalletScopeKey;
  }): Effect.fn.Return<
    BorrowFlowExecutionHandle,
    TransactionWorkflowInputError,
    Scope.Scope
  > {
    const workflow = yield* transactionWorkflow.make(
      new BorrowTransactionWorkflowInput({ action, walletScope })
    );
    const operations = yield* makeScopedSerialOperations();
    const paths = getBorrowTransactionFlowRoutes(intake.entry);

    yield* workflow.states.pipe(
      Stream.filter((state) => state._tag === "Completed"),
      Stream.take(1),
      Stream.runForEach(() =>
        operations.run(
          runOperation(() =>
            navigation.execute({
              _tag: "Replace",
              path: paths.completePath,
            })
          )
        )
      ),
      Effect.retry({ schedule: Schedule.spaced(Duration.millis(100)) }),
      Effect.forkScoped({ startImmediately: true })
    );

    const toOutcome = <A>(
      result:
        | Readonly<{ readonly _tag: "Accepted"; readonly value: A }>
        | Readonly<{ readonly _tag: "RejectedStale" }>
    ): BorrowFlowExecutionOutcome =>
      result._tag === "Accepted"
        ? ({ _tag: "Accepted" } as const)
        : ({ _tag: "RejectedStale" } as const);

    const finishOpen = Effect.fn("BorrowFlowExecution.finishOpen")(
      function* (): Effect.fn.Return<
        Readonly<{ readonly _tag: "Completed" | "NotCompleted" }>,
        WidgetNavigationError
      > {
        const state = yield* workflow.states.pipe(Stream.runHead);
        if (Option.isNone(state) || state.value._tag !== "Completed") {
          return { _tag: "NotCompleted" } as const;
        }
        yield* commitTransition(
          { _tag: "Replace", path: paths.basePath },
          doneOutcome
        );
        return { _tag: "Completed" } as const;
      }
    );

    return {
      back: () =>
        operations.run(
          runOperation(() =>
            navigation.execute({
              _tag: "Replace",
              path: paths.basePath,
            })
          ).pipe(Effect.map(toOutcome))
        ),
      finish: () =>
        operations.run(
          runOperation(finishOpen).pipe(
            Effect.map((result): BorrowFlowFinishOutcome => {
              if (result._tag === "RejectedStale") return result;
              return result.value._tag === "Completed"
                ? ({ _tag: "Accepted" } as const)
                : ({ _tag: "RejectedNotCompleted" } as const);
            })
          )
        ),
      runWorkflow: (command) =>
        operations.run(
          runOperation(() => workflow.dispatch(command)).pipe(
            Effect.map(toOutcome)
          )
        ),
      states: workflow.states,
    };
  });
});
