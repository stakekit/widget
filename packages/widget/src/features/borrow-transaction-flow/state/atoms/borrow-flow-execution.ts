import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { makeScopedEffectStateAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { TransactionWorkflowCommand } from "../../../../services/workflow/transaction-workflow-model";
import {
  emptyBorrowExecutionView,
  getBorrowExecutionSetupError,
  projectBorrowExecution,
} from "../../model/borrow-transaction-workflow";
import type { AcquireBorrowFlowExecutionOutcome } from "../orchestration/borrow-flow-session";
import type { AcquireBorrowFlowSessionOutcome } from "../orchestration/borrow-transaction-flow-service";

export const makeBorrowFlowExecutionScopeAtom = <E>(
  sessionOutcomeAtom: Atom.Atom<
    AsyncResult.AsyncResult<AcquireBorrowFlowSessionOutcome, E>
  >
) =>
  makeScopedEffectStateAtom({
    acquire: (context) =>
      Effect.gen(function* (): Effect.fn.Return<
        AcquireBorrowFlowExecutionOutcome,
        | E
        | import("../../../../services/workflow/transaction-workflow-model").TransactionWorkflowInputError,
        import("effect").Scope.Scope
      > {
        const sessionOutcome = yield* context.result(sessionOutcomeAtom);
        if (sessionOutcome._tag !== "Acquired") {
          return { _tag: "RejectedStale" } as const;
        }
        return yield* sessionOutcome.session.acquireExecution();
      }),
    getStates: (outcome) =>
      outcome._tag === "Acquired" ? outcome.execution.states : Stream.never,
    label: "borrowFlowExecutionScope",
    makeValue: ({ handleAtom, stateAtom }) => {
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
            context
              .result(handleAtom)
              .pipe(
                Effect.flatMap((outcome) =>
                  outcome._tag === "Acquired"
                    ? outcome.execution.runWorkflow(command)
                    : Effect.succeed({ _tag: "RejectedStale" } as const)
                )
              ),
          { concurrent: false, initialValue: undefined }
        )
        .pipe(Atom.withLabel("borrowFlowWorkflowCommand"));
      const backAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context
              .result(handleAtom)
              .pipe(
                Effect.flatMap((outcome) =>
                  outcome._tag === "Acquired"
                    ? outcome.execution.back()
                    : Effect.succeed({ _tag: "RejectedStale" } as const)
                )
              ),
          { initialValue: undefined }
        )
        .pipe(Atom.withLabel("backBorrowFlowExecution"));
      const finishAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context
              .result(handleAtom)
              .pipe(
                Effect.flatMap((outcome) =>
                  outcome._tag === "Acquired"
                    ? outcome.execution.finish()
                    : Effect.succeed({ _tag: "RejectedStale" } as const)
                )
              ),
          { initialValue: undefined }
        )
        .pipe(Atom.withLabel("finishBorrowFlowExecution"));

      return {
        availabilityAtom: handleAtom,
        facade: {
          backAtom,
          finishAtom,
          viewAtom,
          workflowCommandAtom,
        },
        stateAtom,
      } as const;
    },
    runtime: walletRuntime,
  });
