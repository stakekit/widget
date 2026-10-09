import { Data, Effect, Option, type Scope } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { makeScopedEffectStateAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import { getActionInputToken } from "../../../../domain/action/rules";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowInputError,
} from "../../../../services/transaction-workflow/transaction-workflow-model";
import {
  type ClassicFlowSession,
  getClassicTransactionFlowIntakeVariant,
} from "../../model/classic-transaction-flow";
import { getClassicTransactionStepsView } from "../../model/classic-transaction-workflow";
import type { ClassicFlowExecutionHandle } from "../orchestration/classic-flow-execution";
import type { ClassicFlowSessionHandle } from "../orchestration/classic-flow-session";

class ClassicFlowExecutionUnavailableError extends Data.TaggedError(
  "ClassicFlowExecutionUnavailableError"
)<{
  readonly message: string;
}> {}

const getIntakeYieldId = (session: ClassicFlowSession) => {
  switch (session.intake._tag) {
    case "Enter":
    case "Exit":
    case "Manage":
      return session.intake.request.yieldId;
    case "YieldActionContinuation":
      return session.intake.action.yieldId;
  }
};

export const makeClassicFlowExecutionScopeAtom = <E>({
  session,
  sessionAtom,
}: {
  readonly session: ClassicFlowSession;
  readonly sessionAtom: Atom.Atom<
    AsyncResult.AsyncResult<ClassicFlowSessionHandle, E>
  >;
}) =>
  makeScopedEffectStateAtom({
    acquire: (context) =>
      Effect.gen(function* (): Effect.fn.Return<
        ClassicFlowExecutionHandle,
        | E
        | ClassicFlowExecutionUnavailableError
        | TransactionWorkflowInputError,
        Scope.Scope
      > {
        const handle = yield* context.result(sessionAtom);
        const outcome = yield* handle.acquireExecution();
        if (outcome._tag === "RejectedNoReservation") {
          return yield* new ClassicFlowExecutionUnavailableError({
            message:
              "The Classic Flow Session has no reserved execution action.",
          });
        }
        return outcome.execution;
      }),
    getStates: (execution: ClassicFlowExecutionHandle) => execution.states,
    label: "classicFlowExecutionScope",
    makeValue: ({ handleAtom, stateAtom }) => {
      const workflowViewAtom = Atom.make((get) => {
        const result = get(stateAtom);
        const state = Option.getOrNull(AsyncResult.value(result));
        return {
          result,
          state,
          steps: state
            ? getClassicTransactionStepsView(state, {
                yieldId: getIntakeYieldId(session),
              })
            : {
                customSignErrorMessage: null,
                retryable: false,
                txStates: [],
                yieldId: getIntakeYieldId(session),
              },
        } as const;
      }).pipe(Atom.withLabel("classicExecutionWorkflowView"));
      const workflowDispatchAtom = walletRuntime
        .fn(
          (command: TransactionWorkflowCommand, context) =>
            context
              .result(handleAtom)
              .pipe(
                Effect.flatMap((execution) => execution.runWorkflow(command))
              ),
          { concurrent: false, initialValue: undefined }
        )
        .pipe(Atom.withLabel("classicFlowExecutionWorkflowDispatch"));
      const backAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context
              .result(handleAtom)
              .pipe(Effect.flatMap((execution) => execution.back())),
          { initialValue: undefined }
        )
        .pipe(Atom.withLabel("backClassicFlowExecutionAtom"));
      const finishAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context
              .result(handleAtom)
              .pipe(Effect.flatMap((execution) => execution.finish())),
          { initialValue: undefined }
        )
        .pipe(Atom.withLabel("finishClassicFlowExecutionAtom"));
      const activityCompleteViewAtom = Atom.make((get) => {
        const state = Option.getOrNull(AsyncResult.value(get(stateAtom)));
        if (state?.context.domain._tag !== "Classic") return null;
        const activity = getClassicTransactionFlowIntakeVariant(
          session.intake,
          "YieldActionContinuation"
        );
        if (!activity) return null;
        const actionMeta = state.context.domain.actionMeta;
        return {
          inputToken:
            getActionInputToken({
              actionDto: activity.action,
              yieldDto: activity.selectedYield,
            }) ?? null,
          selectedAction: {
            amount: actionMeta.amount,
            intent: activity.action.intent,
            type: actionMeta.actionType,
            yieldId: activity.action.yieldId,
          },
          selectedValidators: activity.selectedValidators,
          selectedYield: activity.selectedYield,
        } as const;
      }).pipe(Atom.withLabel("classicFlowExecutionActivityCompleteView"));

      return {
        availabilityAtom: handleAtom,
        facade: {
          activityCompleteViewAtom,
          backAtom,
          finishAtom,
          workflow: {
            dispatchAtom: workflowDispatchAtom,
            viewAtom: workflowViewAtom,
          },
        },
      } as const;
    },
    runtime: walletRuntime,
  });
