import { Option } from "effect";
import type { Transaction } from "../../../domain/borrow/execution/transaction";
import {
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  type TransactionWorkflowError,
  type TransactionWorkflowState,
} from "../../../services/transaction-workflow/transaction-workflow-model";

type BorrowExecutionPhase =
  | "advancing"
  | "completed"
  | "confirming"
  | "disabled"
  | "signing"
  | "submitting";

const getExecutionStatus = (
  state: TransactionWorkflowState
): Readonly<{
  readonly error: TransactionWorkflowError | null;
  readonly isRunning: boolean;
  readonly phase: BorrowExecutionPhase;
}> => {
  switch (state._tag) {
    case "SignFailed":
      return { error: state.error, isRunning: false, phase: "signing" };
    case "Signing":
      return { error: null, isRunning: true, phase: "signing" };
    case "SubmissionFailed":
      return { error: state.error, isRunning: false, phase: "submitting" };
    case "Submitting":
      return { error: null, isRunning: true, phase: "submitting" };
    case "ConfirmationFailed":
      return { error: state.error, isRunning: false, phase: "confirming" };
    case "Confirming":
      return { error: null, isRunning: true, phase: "confirming" };
    case "AdvanceFailed":
      return { error: state.error, isRunning: false, phase: "advancing" };
    case "Advancing":
      return { error: null, isRunning: true, phase: "advancing" };
    case "Completed":
      return { error: null, isRunning: false, phase: "completed" };
    case "Disabled":
      return { error: null, isRunning: false, phase: "disabled" };
  }
};

export const projectBorrowExecution = (state: TransactionWorkflowState) => {
  const currentBatch = getCurrentTransactionWorkflowBatch(state.context);
  const current = getCurrentTransactionWorkflowTransaction(state.context);
  if (state.context.domain._tag !== "Borrow") {
    throw new Error("Expected Borrow Transaction Workflow state.");
  }
  const action = state.context.domain.action;
  const currentTransaction: Transaction | null =
    current?.source._tag === "Borrow" ? current.source.transaction : null;
  const completed = state._tag === "Completed";
  const status = getExecutionStatus(state);

  return {
    action,
    batches: state.context.batches,
    completionResult: completed
      ? { action, submissions: state.context.submissions }
      : null,
    currentBatchTransactionCount: currentBatch?.transactions.length ?? 0,
    currentStep: currentBatch?.currentStep ?? action.currentStep,
    currentTransaction,
    currentTransactionIndex: state.context.currentTransactionIndex,
    error: status.error,
    isDone: completed,
    isRunning: status.isRunning,
    phase: status.phase,
    state,
    submissions: state.context.submissions,
    totalSteps: currentBatch?.totalSteps ?? action.totalSteps,
  } as const;
};

export const emptyBorrowExecutionView = {
  action: null,
  batches: [],
  completionResult: null,
  currentBatchTransactionCount: 0,
  currentStep: 0,
  currentTransaction: null,
  currentTransactionIndex: null,
  error: null,
  isDone: false,
  isRunning: false,
  phase: "disabled" as const,
  state: null,
  submissions: [],
  totalSteps: 0,
};

export const getBorrowExecutionSetupError = <E>(error: Option.Option<E>) =>
  Option.getOrNull(error);
