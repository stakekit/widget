import { Data, Effect, Option, Ref, type Scope, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { walletRuntime } from "../../../app/runtime/wallet-runtime";
import { getActionInputToken } from "../../../domain/action/rules";
import { getConfidentialActionBatchSide } from "../../../domain/earn/confidential";
import {
  WidgetNavigation,
  type WidgetNavigationCommand,
} from "../../../services/navigation/widget-navigation";
import type {
  TransactionWorkflowCommand,
  TransactionWorkflowInputError,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  type TransactionWorkflowHandle,
  TransactionWorkflowService,
} from "../../../services/transaction-workflow/transaction-workflow-service";
import {
  getYieldFlowWorkflowInput,
  getYieldTransactionFlowIntakeVariant,
  type YieldFlowHandoff,
  type YieldFlowSession,
} from "../model/yield-transaction-flow";
import { getYieldTransactionStepsView } from "../model/yield-transaction-workflow";

// A started router navigation cannot be cancelled, so a page that ends
// meanwhile waits for it instead of abandoning it mid-flight.
const navigate = (command: WidgetNavigationCommand) =>
  WidgetNavigation.use((navigation) =>
    Effect.uninterruptible(navigation.execute(command))
  );

/**
 * Starts `handoff`'s workflow, in the caller's Scope, if it is waiting in the
 * Session. It runs there until the Scope closes, so Review cannot hand off
 * another meanwhile; once it has started, a remount, history navigation, or
 * link to Steps finds nothing waiting and is interrupted.
 */
export const startYieldFlowExecution = Effect.fn("startYieldFlowExecution")(
  function* (
    session: YieldFlowSession,
    handoff: YieldFlowHandoff
  ): Effect.fn.Return<
    TransactionWorkflowHandle,
    TransactionWorkflowInputError,
    Scope.Scope | TransactionWorkflowService
  > {
    const started = yield* Effect.acquireRelease(
      Ref.modify(session.handoff, (current) =>
        current?._tag === "Waiting" && current.handoff === handoff
          ? [true, { _tag: "Running", handoff } as const]
          : ([false, current] as const)
      ),
      (taken) => (taken ? Ref.set(session.handoff, null) : Effect.void)
    );
    if (!started) return yield* Effect.interrupt;

    const transactionWorkflow = yield* TransactionWorkflowService;
    return yield* transactionWorkflow.make(
      getYieldFlowWorkflowInput({ session, source: handoff.source })
    );
  }
);

/** Leaves Execution: back to Review, or out of the finished flow. */
export const leaveYieldFlowExecution = (
  { destination }: YieldFlowSession,
  to: "Exit" | "Review"
) =>
  to === "Review"
    ? navigate({ _tag: "Replace", to: destination.reviewPath })
    : navigate({ _tag: "Push", to: destination.finishPath });

/** One handoff's Execution in a Session. */
export class YieldFlowExecutionKey extends Data.Class<{
  readonly handoff: YieldFlowHandoff;
  readonly session: YieldFlowSession;
}> {}

/**
 * Steps' and Complete's view model for one handoff. Every render,
 * even one React discards, gets the same workflow Atom, so one workflow runs;
 * it runs while Steps or Complete shows it, and leaving both ends it.
 *
 * The model lives in an Atom: a family holds its values only weakly, so the
 * subscribed Atom is what keeps the model alive.
 */
export const yieldFlowExecutionPage = Atom.family(
  ({ handoff, session }: YieldFlowExecutionKey) =>
    Atom.make(makeYieldFlowExecutionPage(session, handoff)).pipe(
      Atom.withLabel("yieldFlowExecutionPage")
    )
);

export const makeYieldFlowExecutionPage = (
  session: YieldFlowSession,
  handoff: YieldFlowHandoff
) => {
  const { intake } = session;
  const yieldId =
    intake._tag === "YieldActionContinuation"
      ? intake.action.yieldId
      : intake.request.yieldId;
  const plannedStepTypes =
    handoff.source._tag === "Prepare" ? handoff.source.plannedStepTypes : [];

  const executionAtom = walletRuntime
    .atom(startYieldFlowExecution(session, handoff))
    .pipe(Atom.withLabel("yieldFlowExecution"));
  const stateAtom = walletRuntime
    .atom((get) =>
      Stream.unwrap(
        get
          .result(executionAtom)
          .pipe(Effect.map((execution) => execution.states))
      )
    )
    .pipe(Atom.withLabel("yieldFlowExecutionState"));

  const workflowViewAtom = Atom.make((get) => {
    const state = Option.getOrNull(AsyncResult.value(get(stateAtom)));
    return {
      state,
      steps: state
        ? getYieldTransactionStepsView(state, {
            plannedStepTypes,
            yieldId,
          })
        : {
            cancelled: false,
            customSignErrorMessage: null,
            numbered: true,
            retryable: false,
            txStates: [],
            yieldId,
          },
    } as const;
  }).pipe(Atom.withLabel("yieldFlowExecutionView"));

  return {
    activityCompleteViewAtom: Atom.make((get) => {
      const { state } = get(workflowViewAtom);
      if (state?.context.domain._tag !== "Yield") return null;
      const activity = getYieldTransactionFlowIntakeVariant(
        intake,
        "YieldActionContinuation"
      );
      if (!activity) return null;
      const { action } = activity;
      return {
        batchSide: getConfidentialActionBatchSide(
          activity.selectedYield,
          action
        ),
        inputToken:
          getActionInputToken({
            actionDto: action,
            yieldDto: activity.selectedYield,
          }) ?? null,
        selectedAction: {
          amount: action.amount?.toFixed() ?? null,
          intent: action.intent,
          type: action.type,
          yieldId: action.yieldId,
        },
        selectedValidators: activity.selectedValidators,
        selectedYield: activity.selectedYield,
      } as const;
    }).pipe(Atom.withLabel("yieldFlowActivityCompleteView")),
    backAtom: walletRuntime
      .fn(() => leaveYieldFlowExecution(session, "Review"), {
        initialValue: undefined,
      })
      .pipe(Atom.withLabel("backYieldFlowExecution")),
    finishAtom: walletRuntime
      .fn(() => leaveYieldFlowExecution(session, "Exit"), {
        initialValue: undefined,
      })
      .pipe(Atom.withLabel("finishYieldFlowExecution")),
    stateAtom,
    workflow: {
      dispatchAtom: walletRuntime
        .fn(
          (command: TransactionWorkflowCommand, get) =>
            get
              .result(executionAtom)
              .pipe(Effect.flatMap((execution) => execution.dispatch(command))),
          { concurrent: false, initialValue: undefined }
        )
        .pipe(Atom.withLabel("dispatchYieldFlowWorkflow")),
      viewAtom: workflowViewAtom,
    },
    executionAtom,
  } as const;
};
