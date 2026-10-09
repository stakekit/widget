import { Duration, Effect, Schedule, type Scope, Stream } from "effect";
import type { YieldAction } from "../../../../domain/action/models";
import {
  toWidgetPath,
  WidgetNavigation,
  type WidgetNavigationCommand,
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

/**
 * Execution of one reserved Classic action. Its operations run only while the
 * Scope it was acquired in is open; the Session closes that Scope when the
 * reservation or the Session ends.
 */
export type ClassicFlowExecutionHandle = Readonly<{
  readonly back: () => Effect.Effect<void, WidgetNavigationError>;
  readonly finish: () => Effect.Effect<void, WidgetNavigationError>;
  readonly runWorkflow: (
    command: TransactionWorkflowCommand
  ) => Effect.Effect<void>;
  readonly states: Stream.Stream<TransactionWorkflowState>;
}>;

export const makeClassicFlowExecutionFactory = Effect.fn(
  "makeClassicFlowExecutionFactory"
)(function* () {
  const navigation = yield* WidgetNavigation;
  const transactionWorkflow = yield* TransactionWorkflowService;
  // A started router navigation cannot be cancelled, so an ending Execution
  // waits for it instead of abandoning it mid-flight.
  const navigate = (command: WidgetNavigationCommand) =>
    Effect.uninterruptible(navigation.execute(command));

  return Effect.fn("makeClassicFlowExecution")(function* ({
    action,
    intake,
    paths,
  }: {
    readonly action: YieldAction;
    readonly intake: ClassicTransactionFlowIntake;
    readonly paths: Readonly<{
      readonly completePath: WidgetPath;
      readonly reviewPath: WidgetPath;
    }>;
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
          .run(navigate({ _tag: "Replace", path: paths.completePath }))
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
        operations.run(navigate({ _tag: "Replace", path: paths.reviewPath })),
      finish: () =>
        operations.run(
          navigate({
            _tag: "Push",
            path: toWidgetPath(
              intake._tag === "YieldActionContinuation" ? "/activity" : "/"
            ),
          })
        ),
      runWorkflow: (command) =>
        operations.run(Effect.suspend(() => workflow.dispatch(command))),
      states: workflow.states,
    };
  });
});
