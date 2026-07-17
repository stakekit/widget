import { useAtomSet } from "@effect/atom-react";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type { Action, Transaction } from "../../../domain/borrow";
import {
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  type TransactionWorkflowBatch,
  type TransactionWorkflowError,
  type TransactionWorkflowState,
  type TransactionWorkflowSubmission,
} from "../../../services/workflow/transaction-workflow-model";
import { transactionWorkflowDispatchAtom } from "../../transaction-flow/state/transaction-workflow-atoms";
import { useBorrowExecutionRouteState } from "./borrow-execution-route";
import type { BorrowExecutionInput } from "./review-state";

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
  readonly input: BorrowExecutionInput;
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

export const useBorrowExecution = (): BorrowExecutionState => {
  const { input, key, result, state } = useBorrowExecutionRouteState();
  const dispatch = useAtomSet(transactionWorkflowDispatchAtom(key));
  const currentBatch = getCurrentTransactionWorkflowBatch(state.context);
  const current = getCurrentTransactionWorkflowTransaction(state.context);
  const latestAction =
    state.context.domain._tag === "Borrow"
      ? state.context.domain.action
      : key.action;
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
    input,
    phase: getPhase(state),
    result,
    retry: () => dispatch({ _tag: "Retry" }),
    submissions: state.context.submissions,
    totalSteps: currentBatch?.totalSteps ?? latestAction.totalSteps,
  };
};
