import type { TFunction } from "i18next";
import type { TransactionType } from "../../../domain/action/rules";
import type {
  ClassicTransactionWorkflowInput,
  TransactionPhaseProgress,
  TransactionWorkflowContext,
  TransactionWorkflowState,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowTransaction,
  getTransactionSignCustomMessage,
  getTransactionStepProgress,
} from "../../../services/transaction-workflow/transaction-workflow-model";

export type ClassicTransactionCompletionUrl = {
  readonly type: TransactionType;
  readonly url: string;
};

export const formatTransactionTypeLabel = (
  type: TransactionType | "DECRYPT" | "ENCRYPT" | "RESET_APPROVAL",
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

/**
 * Terminal success of a Classic workflow: every transaction completed, or the
 * engine found none left to sign (all skipped) and started Disabled.
 */
export const isClassicTransactionWorkflowFinished = (
  state: TransactionWorkflowState
) => state._tag === "Completed" || state._tag === "Disabled";

/** One row of Steps: a transaction, or the step that prepares the action. */
export type ClassicStepRow = Readonly<{
  readonly done: boolean;
  readonly id: string;
  readonly phases: TransactionPhaseProgress;
  /** A preparation the API rejected: only going back can change it. */
  readonly rejected: boolean;
  readonly type: TransactionType | "DECRYPT" | "ENCRYPT" | "RESET_APPROVAL";
}>;

const idle = { broadcast: "idle", confirm: "idle", sign: "idle" } as const;

// A preparation runs in the browser: its one phase is shown as signing.
const getPreparationPhases = (
  state: TransactionWorkflowState,
  done: boolean
): TransactionPhaseProgress => {
  if (done) return { broadcast: "done", confirm: "done", sign: "done" };
  if (state._tag === "Preparing") return { ...idle, sign: "active" };
  if (state._tag === "PrepareFailed") return { ...idle, sign: "failed" };
  return idle;
};

export const getClassicTransactionStepsView = (
  machineState: TransactionWorkflowState,
  {
    preparedTransactionType,
    yieldId,
  }: Pick<ClassicTransactionWorkflowInput, "yieldId"> & {
    /** Labels the API action leg a confidential flow prepares, until it does. */
    readonly preparedTransactionType: TransactionType | null;
  }
) => {
  const { preparation } = machineState.context;
  const currentTransaction = getCurrentTransactionWorkflowTransaction(
    machineState.context
  );
  const preparationRows: ReadonlyArray<ClassicStepRow> = preparation
    ? [
        {
          done: preparation.done,
          id: `prepare-${preparation.step}`,
          phases: getPreparationPhases(machineState, preparation.done),
          rejected:
            machineState._tag === "PrepareFailed" &&
            !machineState.error.retryable,
          type: preparation.step === "encrypt" ? "ENCRYPT" : "DECRYPT",
        },
      ]
    : [];
  // Presentation only, never signed: the API returns its transactions later.
  const preparedRows: ReadonlyArray<ClassicStepRow> =
    preparation && !preparation.done && preparedTransactionType
      ? [
          {
            done: false,
            id: `prepared-${preparedTransactionType}`,
            phases: idle,
            rejected: false,
            type: preparedTransactionType,
          },
        ]
      : [];
  const transactionRows = flattenTransactionWorkflowTransactions(
    machineState.context
  ).flatMap(
    (transaction): ReadonlyArray<ClassicStepRow> =>
      transaction.source._tag === "Borrow"
        ? []
        : [
            {
              done: transaction.meta.done,
              id: transaction.source.transaction.id,
              phases: getTransactionStepProgress(machineState, transaction)
                .phases,
              rejected: false,
              type: transaction.source.transaction.type,
            },
          ]
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
    /** Headers count the steps only when the list is known upfront. */
    numbered: preparation === null,
    retryable:
      (machineState._tag === "PrepareFailed" && machineState.error.retryable) ||
      machineState._tag === "SignFailed" ||
      machineState._tag === "SubmissionFailed" ||
      machineState._tag === "ConfirmationFailed" ||
      machineState._tag === "AdvanceFailed",
    txStates: [...preparationRows, ...transactionRows, ...preparedRows],
    yieldId,
  } as const;
};
