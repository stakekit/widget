import { Duration, Effect, Option, Schedule, type Scope, Stream } from "effect";
import type { Action } from "../../../../domain/borrow/execution/action";
import type { WalletScopeKey } from "../../../../domain/wallet/wallet-scope";
import {
  WidgetNavigation,
  type WidgetNavigationCommand,
  type WidgetNavigationError,
} from "../../../../services/navigation/widget-navigation";
import {
  BorrowTransactionWorkflowInput,
  type TransactionWorkflowCommand,
  type TransactionWorkflowInputError,
  type TransactionWorkflowState,
} from "../../../../services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../../services/transaction-workflow/transaction-workflow-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import type { BorrowTransactionFlowIntake } from "../../model/borrow-transaction-flow";
import { getBorrowTransactionFlowRoutes } from "../../model/borrow-transaction-flow";

type BorrowFlowFinishOutcome =
  | Readonly<{ readonly _tag: "Accepted" }>
  | Readonly<{ readonly _tag: "RejectedNotCompleted" }>;

/**
 * Execution of one reserved Borrow action. Its operations run only while the
 * Scope it was acquired in is open; the Session closes that Scope when the
 * reservation or the Session ends.
 */
export type BorrowFlowExecutionHandle = Readonly<{
  readonly back: () => Effect.Effect<void, WidgetNavigationError>;
  readonly finish: () => Effect.Effect<
    BorrowFlowFinishOutcome,
    WidgetNavigationError
  >;
  readonly runWorkflow: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<void>;
  readonly states: Stream.Stream<TransactionWorkflowState>;
}>;

export const makeBorrowFlowExecutionFactory = Effect.fn(
  "makeBorrowFlowExecutionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const transactionWorkflow = yield* TransactionWorkflowService;
  // A started router navigation cannot be cancelled, so an ending Execution
  // waits for it instead of abandoning it mid-flight.
  const navigate = (command: WidgetNavigationCommand) =>
    Effect.uninterruptible(navigation.execute(command));

  return Effect.fn("makeBorrowFlowExecution")(function* ({
    action,
    intake,
    walletScope,
  }: {
    readonly action: Action;
    readonly intake: BorrowTransactionFlowIntake;
    readonly walletScope: WalletScopeKey;
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
        operations.run(navigate({ _tag: "Replace", path: paths.completePath }))
      ),
      Effect.retry({ schedule: Schedule.spaced(Duration.millis(100)) }),
      Effect.forkScoped({ startImmediately: true })
    );

    const finishOpen = Effect.fn("BorrowFlowExecution.finish")(
      function* (): Effect.fn.Return<
        BorrowFlowFinishOutcome,
        WidgetNavigationError
      > {
        const state = yield* workflow.states.pipe(Stream.runHead);
        if (Option.isNone(state) || state.value._tag !== "Completed") {
          return { _tag: "RejectedNotCompleted" } as const;
        }
        yield* navigate({ _tag: "Replace", path: paths.basePath });
        return { _tag: "Accepted" } as const;
      }
    );

    return {
      back: () =>
        operations.run(navigate({ _tag: "Replace", path: paths.basePath })),
      finish: () => operations.run(finishOpen()),
      runWorkflow: (command) =>
        operations.run(Effect.suspend(() => workflow.dispatch(command))),
      states: workflow.states,
    };
  });
});
