import { Data, Effect, Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
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
import type { AcquireClassicFlowSessionOutcome } from "../orchestration/classic-transaction-flow-service";

class ClassicFlowExecutionUnavailableError extends Data.TaggedError(
  "ClassicFlowExecutionUnavailableError"
)<{
  readonly message: string;
}> {}

const unavailable = (reason: "no-reservation" | "stale") =>
  new ClassicFlowExecutionUnavailableError({
    message:
      reason === "stale"
        ? "The Classic Flow route no longer owns its Session."
        : "The Classic Flow Session has no reserved execution action.",
  });

const getIntakeYieldId = (session: ClassicFlowSession) => {
  switch (session.intake._tag) {
    case "Enter":
    case "Exit":
    case "Manage":
      return session.intake.request.yieldId;
    case "ActivityResume":
      return session.intake.action.yieldId;
  }
};

export const makeClassicFlowExecutionScopeAtom = <E>({
  session,
  sessionOutcomeAtom,
}: {
  readonly session: ClassicFlowSession;
  readonly sessionOutcomeAtom: Atom.Atom<
    AsyncResult.AsyncResult<AcquireClassicFlowSessionOutcome, E>
  >;
}) =>
  makeScopedEffectStateAtom({
    acquire: (context) =>
      Effect.gen(function* (): Effect.fn.Return<
        ClassicFlowExecutionHandle,
        | E
        | ClassicFlowExecutionUnavailableError
        | TransactionWorkflowInputError,
        import("effect").Scope.Scope
      > {
        const sessionOutcome = yield* context.result(sessionOutcomeAtom);
        if (sessionOutcome._tag !== "Acquired") {
          return yield* unavailable("stale");
        }
        const outcome = yield* sessionOutcome.session.acquireExecution();
        switch (outcome._tag) {
          case "Acquired":
            return outcome.execution;
          case "RejectedNoReservation":
            return yield* unavailable("no-reservation");
          case "RejectedStale":
            return yield* unavailable("stale");
        }
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
          "ActivityResume"
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
