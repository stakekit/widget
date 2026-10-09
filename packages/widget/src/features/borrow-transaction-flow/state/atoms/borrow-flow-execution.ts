import { Effect, Option, type Scope, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { makeScopedEffectStateAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowInputError,
} from "../../../../services/transaction-workflow/transaction-workflow-model";
import {
  emptyBorrowExecutionView,
  getBorrowExecutionSetupError,
  projectBorrowExecution,
} from "../../model/borrow-transaction-workflow";
import type { BorrowFlowExecutionHandle } from "../orchestration/borrow-flow-execution";
import type {
  AcquireBorrowFlowExecutionOutcome,
  BorrowFlowSessionHandle,
} from "../orchestration/borrow-flow-session";

export const makeBorrowFlowExecutionScopeAtom = <E>(
  sessionAtom: Atom.Atom<AsyncResult.AsyncResult<BorrowFlowSessionHandle, E>>
) =>
  makeScopedEffectStateAtom({
    acquire: (context) =>
      Effect.gen(function* (): Effect.fn.Return<
        AcquireBorrowFlowExecutionOutcome,
        E | TransactionWorkflowInputError,
        Scope.Scope
      > {
        const session = yield* context.result(sessionAtom);
        return yield* session.acquireExecution();
      }),
    getStates: (outcome) =>
      outcome._tag === "Acquired" ? outcome.execution.states : Stream.never,
    label: "borrowFlowExecutionScope",
    makeValue: ({ handleAtom, stateAtom }) => {
      // Without a reserved Execution there is nothing for a command to run in.
      const withExecution =
        <A, E2>(
          use: (execution: BorrowFlowExecutionHandle) => Effect.Effect<A, E2>
        ) =>
        (context: Atom.FnContext) =>
          context
            .result(handleAtom)
            .pipe(
              Effect.flatMap((outcome) =>
                outcome._tag === "Acquired"
                  ? use(outcome.execution)
                  : Effect.interrupt
              )
            );

      // Read the existing workflow afresh on completion-route mount. Do not
      // reacquire its execution or consult the potentially lagging viewAtom.
      const makeCompletionStateAtom = () =>
        walletRuntime
          .atom((context) =>
            Stream.unwrap(
              context
                .result(handleAtom)
                .pipe(
                  Effect.map((outcome) =>
                    outcome._tag === "Acquired"
                      ? outcome.execution.states.pipe(
                          Stream.map((state) => state._tag === "Completed")
                        )
                      : Stream.succeed(false)
                  )
                )
            )
          )
          .pipe(Atom.withLabel("borrowFlowCompletionState"));

      const viewAtom = Atom.make((get) => {
        const result = get(stateAtom);
        const state = Option.getOrNull(AsyncResult.value(result));
        return {
          ...(state ? projectBorrowExecution(state) : emptyBorrowExecutionView),
          result,
          setupError: getBorrowExecutionSetupError(AsyncResult.error(result)),
        } as const;
      }).pipe(Atom.withLabel("borrowFlowExecutionView"));

      const workflowCommandAtom = walletRuntime
        .fn(
          (command: TransactionWorkflowCommand, context) =>
            withExecution((execution) => execution.runWorkflow(command))(
              context
            ),
          { concurrent: false, initialValue: undefined }
        )
        .pipe(Atom.withLabel("borrowFlowWorkflowCommand"));
      const backAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            withExecution((execution) => execution.back())(context),
          { initialValue: undefined }
        )
        .pipe(Atom.withLabel("backBorrowFlowExecution"));
      const finishAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            withExecution((execution) => execution.finish())(context),
          { initialValue: undefined }
        )
        .pipe(Atom.withLabel("finishBorrowFlowExecution"));

      return {
        availabilityAtom: handleAtom,
        facade: {
          backAtom,
          finishAtom,
          makeCompletionStateAtom,
          viewAtom,
          workflowCommandAtom,
        },
        stateAtom,
      } as const;
    },
    runtime: walletRuntime,
  });
