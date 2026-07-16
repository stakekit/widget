import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { Action, Transaction } from "../../../domain/borrow";
import {
  BorrowTransactionWorkflowKey,
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  initializeTransactionWorkflow,
  type TransactionWorkflowBatch,
  type TransactionWorkflowError,
  type TransactionWorkflowState,
  type TransactionWorkflowSubmission,
} from "../../../services/workflow/transaction-workflow-model";
import {
  transactionWorkflowDispatchAtom,
  transactionWorkflowStateAtom,
} from "../../transaction-flow/state/transaction-workflow-atoms";
import { borrowExecutionRefreshAtom } from "../atoms/refresh";

type BorrowExecutionResult = {
  readonly action: Action;
  readonly submissions: ReadonlyArray<TransactionWorkflowSubmission>;
};

type BorrowExecutionPhase =
  | "signing"
  | "submitting"
  | "confirming"
  | "advancing"
  | "completed"
  | "disabled";

type BorrowExecutionState = {
  readonly action: Action;
  readonly batches: ReadonlyArray<TransactionWorkflowBatch>;
  readonly completionResult: BorrowExecutionResult | null;
  readonly currentBatchTransactionCount: number;
  readonly currentStep: number;
  readonly currentTransaction: Transaction | null;
  readonly currentTransactionIndex: number | null;
  readonly error: TransactionWorkflowError | null;
  readonly isDone: boolean;
  readonly isRunning: boolean;
  readonly phase: BorrowExecutionPhase;
  readonly result: AsyncResult.AsyncResult<TransactionWorkflowState, unknown>;
  readonly retry: () => void;
  readonly submissions: ReadonlyArray<TransactionWorkflowSubmission>;
  readonly totalSteps: number;
};

const getStateError = (
  state: TransactionWorkflowState
): TransactionWorkflowError | null => {
  switch (state._tag) {
    case "SignFailed":
    case "SubmissionFailed":
    case "ConfirmationFailed":
    case "AdvanceFailed":
      return state.error;
    case "Disabled":
    case "Signing":
    case "Submitting":
    case "Confirming":
    case "Advancing":
    case "Completed":
      return null;
  }
};

const getPhase = (state: TransactionWorkflowState): BorrowExecutionPhase => {
  switch (state._tag) {
    case "SignFailed":
    case "Signing":
      return "signing";
    case "SubmissionFailed":
    case "Submitting":
      return "submitting";
    case "ConfirmationFailed":
    case "Confirming":
      return "confirming";
    case "AdvanceFailed":
    case "Advancing":
      return "advancing";
    case "Completed":
      return "completed";
    case "Disabled":
      return "disabled";
  }
};

export const useBorrowExecution = ({
  action,
}: {
  readonly action: Action;
}): BorrowExecutionState => {
  const key = new BorrowTransactionWorkflowKey({ action });
  useAtomMount(borrowExecutionRefreshAtom(key));
  const result = useAtomValue(transactionWorkflowStateAtom(key));
  const dispatch = useAtomSet(transactionWorkflowDispatchAtom(key));
  const state = Option.getOrElse(AsyncResult.value(result), () =>
    initializeTransactionWorkflow(key)
  );
  const currentBatch = getCurrentTransactionWorkflowBatch(state.context);
  const current = getCurrentTransactionWorkflowTransaction(state.context);
  const latestAction =
    state.context.domain._tag === "Borrow"
      ? state.context.domain.action
      : action;
  const currentTransaction =
    current?.source._tag === "Borrow" ? current.source.transaction : null;
  const isDone = state._tag === "Completed";

  return {
    action: latestAction,
    batches: state.context.batches,
    completionResult: isDone
      ? { action: latestAction, submissions: state.context.submissions }
      : null,
    currentBatchTransactionCount: currentBatch?.transactions.length ?? 0,
    currentStep: currentBatch?.currentStep ?? latestAction.currentStep,
    currentTransaction,
    currentTransactionIndex: state.context.currentTransactionIndex,
    error: getStateError(state),
    isDone,
    isRunning:
      state._tag === "Signing" ||
      state._tag === "Submitting" ||
      state._tag === "Confirming" ||
      state._tag === "Advancing",
    phase: getPhase(state),
    result,
    retry: () => dispatch({ _tag: "Retry" }),
    submissions: state.context.submissions,
    totalSteps: currentBatch?.totalSteps ?? latestAction.totalSteps,
  };
};
