import { Duration, Effect, Option, Schedule, type Scope, Stream } from "effect";
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
import { isClassicTransactionWorkflowFinished } from "../../model/classic-transaction-workflow";

type ClassicFlowFinishOutcome =
  | Readonly<{ readonly _tag: "Accepted" }>
  | Readonly<{ readonly _tag: "RejectedNotCompleted" }>;

/**
 * Execution of one reserved Classic action. Its operations run only while the
 * Scope it was acquired in is open; the Session closes that Scope when the
 * reservation or the Session ends.
 */
export type ClassicFlowExecutionHandle = Readonly<{
  readonly back: () => Effect.Effect<void, WidgetNavigationError>;
  readonly finish: () => Effect.Effect<
    ClassicFlowFinishOutcome,
    WidgetNavigationError
  >;
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
      Stream.filter(isClassicTransactionWorkflowFinished),
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

    const finishOpen = Effect.fn("ClassicFlowExecution.finish")(
      function* (): Effect.fn.Return<
        ClassicFlowFinishOutcome,
        WidgetNavigationError
      > {
        const state = yield* workflow.states.pipe(Stream.runHead);
        if (
          Option.isNone(state) ||
          !isClassicTransactionWorkflowFinished(state.value)
        ) {
          return { _tag: "RejectedNotCompleted" } as const;
        }
        yield* navigate({
          _tag: "Push",
          path: toWidgetPath(
            intake._tag === "YieldActionContinuation" ? "/activity" : "/"
          ),
        });
        return { _tag: "Accepted" } as const;
      }
    );

    return {
      back: () =>
        operations.run(navigate({ _tag: "Replace", path: paths.reviewPath })),
      finish: () => operations.run(finishOpen()),
      runWorkflow: (command) =>
        operations.run(Effect.suspend(() => workflow.dispatch(command))),
      states: workflow.states,
    };
  });
});
