import { Option } from "effect";
import type { Transaction } from "../../../domain/borrow/execution/transaction";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  getTransactionSignCustomMessage,
  getTransactionWorkflowStepState,
  type TransactionWorkflowError,
  type TransactionWorkflowState,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import type { TransactionStepState } from "../../../shared/lib/transaction-step-state";

type BorrowExecutionStep = {
  readonly done: boolean;
  readonly explorerUrl: string | null;
  readonly id: string;
  readonly state: TransactionStepState;
  readonly type: Transaction["type"];
};

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

/**
 * Leaving drops the reserved action. While the wallet holds the current
 * transaction, or its broadcast hash has not reached the API, the transaction
 * may land on-chain with no record, so the flow must stay open.
 */
export const canLeaveBorrowExecution = (state: TransactionWorkflowState) => {
  switch (state._tag) {
    case "Signing":
    case "Submitting":
      return false;
    case "SubmissionFailed":
      return (
        getCurrentTransactionWorkflowTransaction(state.context)?.meta
          .broadcasted !== true
      );
    default:
      return true;
  }
};

const isWalletCancellation = (error: TransactionWorkflowError | null) =>
  error?._tag === "TransactionSignError" &&
  error.reason._tag === "WalletRequestCancelled";

// A wallet cancellation is not a failure; the flow shows it as a notice.
const getExecutionErrorMessage = (error: TransactionWorkflowError | null) => {
  if (!error || isWalletCancellation(error)) return null;
  const customMessage =
    error._tag === "TransactionSignError"
      ? getTransactionSignCustomMessage(error)
      : null;
  return customMessage ?? error.message;
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
    canLeave: canLeaveBorrowExecution(state),
    cancelled: isWalletCancellation(status.error),
    completionResult: completed
      ? { action, submissions: state.context.submissions }
      : null,
    currentStep: currentBatch?.currentStep ?? action.currentStep,
    currentTransaction,
    error: status.error,
    errorMessage: getExecutionErrorMessage(status.error),
    isDone: completed,
    isRunning: status.isRunning,
    phase: status.phase,
    state,
    steps: flattenTransactionWorkflowTransactions(state.context).flatMap(
      (transaction): ReadonlyArray<BorrowExecutionStep> => {
        if (transaction.source._tag !== "Borrow") return [];

        const submission =
          transaction.meta.submissionIndex === null
            ? null
            : state.context.submissions[transaction.meta.submissionIndex];

        return [
          {
            done: transaction.meta.done,
            explorerUrl: transaction.meta.url ?? submission?.link ?? null,
            id: transaction.source.transaction.id,
            state: getTransactionWorkflowStepState(state, transaction),
            type: transaction.source.transaction.type,
          },
        ];
      }
    ),
    totalSteps: currentBatch?.totalSteps ?? action.totalSteps,
  } as const;
};

const noBorrowExecutionSteps: ReadonlyArray<BorrowExecutionStep> = [];

export const emptyBorrowExecutionView = {
  action: null,
  batches: [],
  canLeave: true,
  cancelled: false,
  completionResult: null,
  currentStep: 0,
  currentTransaction: null,
  error: null,
  errorMessage: null,
  isDone: false,
  isRunning: false,
  phase: "disabled" as const,
  state: null,
  steps: noBorrowExecutionSteps,
  totalSteps: 0,
};

export const getBorrowExecutionSetupError = <E>(error: Option.Option<E>) =>
  Option.getOrNull(error);
