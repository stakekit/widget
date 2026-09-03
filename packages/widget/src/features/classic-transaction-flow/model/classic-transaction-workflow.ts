import type { TFunction } from "i18next";
import type { YieldAction } from "../../../domain/action/models";
import type { TransactionType } from "../../../domain/action/rules";
import type {
  ClassicTransactionWorkflowInput,
  TransactionWorkflowContext,
  TransactionWorkflowState,
  TransactionWorkflowTransactionMeta,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowTransaction,
  getTransactionSignCustomMessage,
} from "../../../services/transaction-workflow/transaction-workflow-model";

export type ClassicTransactionCompletionUrl = {
  readonly type: TransactionType;
  readonly url: string;
};

export const formatTransactionTypeLabel = (
  type: TransactionType,
  t: TFunction,
  options?: { readonly context?: "ETHENA_USDE" }
) =>
  t(`steps.tx_type.${type}`, {
    context: options?.context,
    defaultValue: type.replaceAll("_", " "),
  });

export const getClassicTransactionCompletionUrls = (
  context: TransactionWorkflowContext
): ReadonlyArray<ClassicTransactionCompletionUrl> =>
  flattenTransactionWorkflowTransactions(context)
    .filter((transaction) => transaction.source._tag === "Classic")
    .map((transaction) => ({
      type: transaction.source.transaction.type,
      url: transaction.meta.url,
    }))
    .filter((value): value is ClassicTransactionCompletionUrl => !!value.url);

export enum ClassicTransactionStepState {
  SIGN_IDLE = 0,
  SIGN_ERROR = 1,
  SIGN_LOADING = 2,
  SIGN_SUCCESS = 3,
  BROADCAST_ERROR = 5,
  BROADCAST_LOADING = 6,
  BROADCAST_SUCCESS = 7,
  CHECK_TX_STATUS_ERROR = 9,
  CHECK_TX_STATUS_LOADING = 10,
  CHECK_TX_STATUS_SUCCESS = 11,
}

type ClassicTransactionState = {
  readonly meta: TransactionWorkflowTransactionMeta;
  readonly tx: YieldAction["transactions"][number];
};

const getClassicTransactionStepState = ({
  currentTxId,
  machineState,
  txState,
}: {
  readonly currentTxId: string | null;
  readonly machineState: TransactionWorkflowState;
  readonly txState: ClassicTransactionState;
}): ClassicTransactionStepState => {
  if (txState.meta.done) {
    return ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS;
  }
  if (currentTxId === null || currentTxId !== txState.tx.id) {
    return ClassicTransactionStepState.SIGN_IDLE;
  }

  switch (machineState._tag) {
    case "Signing":
      return ClassicTransactionStepState.SIGN_LOADING;
    case "SignFailed":
      return ClassicTransactionStepState.SIGN_ERROR;
    case "Submitting":
      return ClassicTransactionStepState.BROADCAST_LOADING;
    case "SubmissionFailed":
      return ClassicTransactionStepState.BROADCAST_ERROR;
    case "ConfirmationFailed":
      return ClassicTransactionStepState.CHECK_TX_STATUS_ERROR;
    case "Confirming":
    case "Advancing":
      return ClassicTransactionStepState.CHECK_TX_STATUS_LOADING;
    case "AdvanceFailed":
      return ClassicTransactionStepState.CHECK_TX_STATUS_ERROR;
    case "Completed":
      return ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS;
    case "Disabled":
      return ClassicTransactionStepState.SIGN_IDLE;
  }
};

export const getClassicTransactionStepsView = (
  machineState: TransactionWorkflowState,
  workflowInput: Pick<ClassicTransactionWorkflowInput, "yieldId">
) => {
  const workflowTransactions = flattenTransactionWorkflowTransactions(
    machineState.context
  );
  const currentTransaction = getCurrentTransactionWorkflowTransaction(
    machineState.context
  );
  const txStates = workflowTransactions.flatMap((transaction) => {
    if (transaction.source._tag !== "Classic") return [];

    const txState: ClassicTransactionState = {
      meta: transaction.meta,
      tx: transaction.source.transaction,
    };
    return [
      {
        ...txState,
        state: getClassicTransactionStepState({
          currentTxId: currentTransaction?.source.transaction.id ?? null,
          machineState,
          txState,
        }),
      },
    ];
  });
  const signError = currentTransaction?.meta.signError ?? null;
  const customSignErrorMessage = signError
    ? getTransactionSignCustomMessage(signError)
    : null;
  return {
    customSignErrorMessage,
    retryable:
      machineState._tag === "SignFailed" ||
      machineState._tag === "SubmissionFailed" ||
      machineState._tag === "ConfirmationFailed" ||
      machineState._tag === "AdvanceFailed",
    txStates,
    yieldId: workflowInput.yieldId,
  } as const;
};
