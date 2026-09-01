import { Duration, Effect, Schedule, type Scope, Stream } from "effect";
import type { YieldAction } from "../../../../domain/action/models";
import {
  toWidgetPath,
  WidgetNavigation,
  type WidgetNavigationError,
  type WidgetPath,
} from "../../../../services/navigation/widget-navigation";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowInputError,
  TransactionWorkflowState,
} from "../../../../services/transaction-workflow/transaction-workflow-model";
import { TransactionWorkflowService } from "../../../../services/transaction-workflow/transaction-workflow-service";
import { makeScopedSerialOperations } from "../../../../shared/effect/scoped-serial-operations";
import {
  type ClassicTransactionFlowIntake,
  getClassicTransactionWorkflowInput,
} from "../../model/classic-transaction-flow";

type ClassicFlowExecutionOutcome =
  | Readonly<{ readonly _tag: "Accepted" }>
  | Readonly<{ readonly _tag: "RejectedStale" }>;

export type ClassicFlowExecutionHandle = Readonly<{
  readonly back: () => Effect.Effect<
    ClassicFlowExecutionOutcome,
    WidgetNavigationError
  >;
  readonly finish: () => Effect.Effect<
    ClassicFlowExecutionOutcome,
    WidgetNavigationError
  >;
  readonly runWorkflow: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<ClassicFlowExecutionOutcome>;
  readonly states: Stream.Stream<TransactionWorkflowState>;
}>;

export const makeClassicFlowExecutionFactory = Effect.fn(
  "makeClassicFlowExecutionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const transactionWorkflow = yield* TransactionWorkflowService;

  return Effect.fn("makeClassicFlowExecution")(function* ({
    action,
    intake,
    paths,
    runOperation,
  }: {
    readonly action: YieldAction;
    readonly intake: ClassicTransactionFlowIntake;
    readonly paths: Readonly<{
      readonly completePath: WidgetPath;
      readonly reviewPath: WidgetPath;
    }>;
    readonly runOperation: <E>(
      operation: () => Effect.Effect<void, E>
    ) => Effect.Effect<ClassicFlowExecutionOutcome, E>;
  }): Effect.fn.Return<
    ClassicFlowExecutionHandle,
    TransactionWorkflowInputError,
    Scope.Scope
  > {
    const workflow = yield* transactionWorkflow.make(
      getClassicTransactionWorkflowInput(intake, action)
    );
    const operations = yield* makeScopedSerialOperations();

    yield* workflow.states.pipe(
      Stream.filter(
        (
          state
        ): state is Extract<
          TransactionWorkflowState,
          { readonly _tag: "Completed" | "Disabled" }
        > => state._tag === "Completed" || state._tag === "Disabled"
      ),
      Stream.take(1),
      Stream.runForEach(() =>
        operations
          .run(
            runOperation(() =>
              navigation.execute({
                _tag: "Replace",
                path: paths.completePath,
              })
            )
          )
          .pipe(
            Effect.retry({
              schedule: Schedule.spaced(Duration.millis(100)),
            })
          )
      ),
      Effect.forkScoped({ startImmediately: true })
    );

    return {
      back: () =>
        operations.run(
          runOperation(() =>
            navigation.execute({
              _tag: "Replace",
              path: paths.reviewPath,
            })
          )
        ),
      finish: () =>
        operations.run(
          runOperation(() =>
            navigation.execute({
              _tag: "Push",
              path: toWidgetPath(
                intake._tag === "YieldActionContinuation" ? "/activity" : "/"
              ),
            })
          )
        ),
      runWorkflow: (command) =>
        operations.run(runOperation(() => workflow.dispatch(command))),
      states: workflow.states,
    };
  });
});
