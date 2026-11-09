import type { Transaction } from "../../../domain/borrow/transaction";
import type { TransactionHash } from "../../../domain/identity/identifiers";
import {
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  isTransactionWorkflowSent,
  projectTransactionWorkflowTransactions,
  type TransactionStepProgress,
  type TransactionWorkflowError,
  type TransactionWorkflowState,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import type { BorrowTransactionFlowReview } from "./review";

type BorrowExecutionStep = {
  readonly done: boolean;
  readonly explorerUrl: string | null;
  /** The sent transaction's hash, once it has one. */
  readonly hash: TransactionHash | null;
  readonly id: Transaction["id"];
  readonly progress: TransactionStepProgress;
  readonly sent: boolean;
  readonly type: Transaction["type"];
};

/** A submitted transaction of a completed action, for the completion page. */
type BorrowCompletedTransaction = {
  readonly explorerUrl: string;
  readonly hash: TransactionHash | null;
  readonly id: Transaction["id"];
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
    // Only a confidential Yield workflow prepares its action.
    case "Preparing":
    case "PrepareFailed":
      return { error: null, isRunning: false, phase: "disabled" };
  }
};

const isWalletCancellation = (error: TransactionWorkflowError | null) =>
  error?._tag === "TransactionSignError" &&
  error.reason._tag === "WalletRequestCancelled";

/**
 * Steps' and Complete's view of the workflow. `flowAction` is the action
 * Review summarised, which says whether the flow supplies collateral before
 * it borrows.
 */
export const projectBorrowExecution = (
  state: TransactionWorkflowState,
  flowAction: BorrowTransactionFlowReview["summary"]["action"]
) => {
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
  const steps = projectTransactionWorkflowTransactions(state).flatMap(
    ({ source, ...transaction }): ReadonlyArray<BorrowExecutionStep> =>
      source._tag === "Borrow"
        ? [
            {
              ...transaction,
              id: source.transaction.id,
              type: source.transaction.type,
            },
          ]
        : []
  );

  return {
    action,
    batches: state.context.batches,
    cancelled: isWalletCancellation(status.error),
    /**
     * A borrow that stopped after its collateral went in leaves that
     * collateral supplied, whether it failed or the user declined it.
     */
    collateralSupplied:
      status.error !== null &&
      flowAction === "borrowAndSupply" &&
      steps.some((step) => step.done && step.type === "SUPPLY"),
    completionResult: completed
      ? {
          action,
          transactions: state.context.submissions.flatMap(
            (submission): ReadonlyArray<BorrowCompletedTransaction> =>
              submission.source._tag === "Borrow" && submission.link
                ? [
                    {
                      explorerUrl: submission.link,
                      hash: submission.hash,
                      id: submission.source.transaction.id,
                      type: submission.source.transaction.type,
                    },
                  ]
                : []
          ),
        }
      : null,
    currentStep: currentBatch?.currentStep ?? action.currentStep,
    currentTransaction,
    error: status.error,
    isDone: completed,
    isRunning: status.isRunning,
    phase: status.phase,
    /** What is sent cannot be called back. */
    sent: isTransactionWorkflowSent(steps),
    state,
    steps,
    totalSteps: currentBatch?.totalSteps ?? action.totalSteps,
  } as const;
};

const noBorrowExecutionSteps: ReadonlyArray<BorrowExecutionStep> = [];

export const emptyBorrowExecutionView = {
  action: null,
  batches: [],
  cancelled: false,
  collateralSupplied: false,
  completionResult: null,
  currentStep: 0,
  currentTransaction: null,
  error: null,
  isDone: false,
  isRunning: false,
  phase: "disabled" as const,
  sent: false,
  state: null,
  steps: noBorrowExecutionSteps,
  totalSteps: 0,
};
