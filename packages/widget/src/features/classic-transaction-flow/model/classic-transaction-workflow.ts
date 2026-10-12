import type { TFunction } from "i18next";
import type { TransactionType } from "../../../domain/action/rules";
import type {
  ClassicTransactionWorkflowInput,
  TransactionWorkflowContext,
  TransactionWorkflowState,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowTransaction,
  getTransactionSignCustomMessage,
  getTransactionWorkflowStepState,
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
  const txStates = workflowTransactions.flatMap((transaction) =>
    transaction.source._tag === "Classic"
      ? [
          {
            meta: transaction.meta,
            state: getTransactionWorkflowStepState(machineState, transaction),
            tx: transaction.source.transaction,
          },
        ]
      : []
  );
  const signError = currentTransaction?.meta.signError ?? null;
  const customSignErrorMessage = signError
    ? getTransactionSignCustomMessage(signError)
    : null;
  return {
    cancelled:
      machineState._tag === "SignFailed" &&
      machineState.error.reason._tag === "WalletRequestCancelled",
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
