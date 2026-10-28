import type { TFunction } from "i18next";
import type { TransactionType } from "../../../domain/action/rules";
import type {
  TransactionPhaseProgress,
  TransactionWorkflowContext,
  TransactionWorkflowState,
  YieldTransactionWorkflowInput,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowTransaction,
  getTransactionSignCustomMessage,
  getTransactionStepProgress,
} from "../../../services/transaction-workflow/transaction-workflow-model";

export type YieldTransactionCompletionUrl = {
  readonly type: TransactionType;
  readonly url: string;
};

export const formatTransactionTypeLabel = (
  type: TransactionType | "DECRYPT" | "ENCRYPT" | "RESET_APPROVAL",
  t: TFunction,
  options?: { readonly context?: "ETHENA_USDE" | undefined }
) =>
  t(`steps.tx_type.${type}`, {
    context: options?.context,
    defaultValue: type.replaceAll("_", " "),
  });

export const getYieldTransactionCompletionUrls = (
  context: TransactionWorkflowContext
): ReadonlyArray<YieldTransactionCompletionUrl> =>
  flattenTransactionWorkflowTransactions(context)
    .filter((transaction) => transaction.source._tag === "Yield")
    .map((transaction) => ({
      type: transaction.source.transaction.type,
      url: transaction.meta.url,
    }))
    .filter((value): value is YieldTransactionCompletionUrl => !!value.url);

/**
 * Terminal success of a Yield workflow: every transaction completed, or the
 * engine found none left to sign (all skipped) and started Disabled.
 */
export const isYieldTransactionWorkflowFinished = (
  state: TransactionWorkflowState
) => state._tag === "Completed" || state._tag === "Disabled";

/** One row of Steps: a transaction, or the step that prepares the action. */
export type YieldStepRow = Readonly<{
  readonly done: boolean;
  readonly id: string;
  readonly phases: TransactionPhaseProgress;
  /** A preparation the API rejected: only going back can change it. */
  readonly rejected: boolean;
  readonly type: TransactionType | "DECRYPT" | "ENCRYPT" | "RESET_APPROVAL";
}>;

/** A step Steps lists before the API returns it: an API leg or a finalize. */
export type PlannedStepType = TransactionType | "DECRYPT";

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

const toPreparationRow = (
  state: TransactionWorkflowState,
  { done, id, type }: Pick<YieldStepRow, "done" | "id" | "type">
): YieldStepRow => ({
  done,
  id,
  phases: getPreparationPhases(state, done),
  rejected: !done && state._tag === "PrepareFailed" && !state.error.retryable,
  type,
});

/**
 * The planned steps still to come: all until the action is prepared, then an
 * instant exit's finalize and what follows it until that is prepared too.
 */
const getPendingPlannedSteps = (
  context: TransactionWorkflowContext,
  planned: ReadonlyArray<PlannedStepType>
) => {
  const { finalize, preparation } = context;
  if (preparation && !preparation.done) return planned;
  const finalizeIndex = planned.indexOf("DECRYPT");
  if (finalizeIndex === -1 || finalize?.done) return [];
  return planned.slice(finalize ? finalizeIndex + 1 : finalizeIndex);
};

export const getYieldTransactionStepsView = (
  machineState: TransactionWorkflowState,
  {
    plannedStepTypes,
    yieldId,
  }: Pick<YieldTransactionWorkflowInput, "yieldId"> & {
    /** The Planned Steps a confidential flow lists until it prepares them. */
    readonly plannedStepTypes: ReadonlyArray<PlannedStepType>;
  }
) => {
  const { finalize, preparation } = machineState.context;
  const currentTransaction = getCurrentTransactionWorkflowTransaction(
    machineState.context
  );
  const preparationRows: ReadonlyArray<YieldStepRow> = preparation
    ? [
        toPreparationRow(machineState, {
          done: preparation.done,
          id: `prepare-${preparation.step}`,
          type: preparation.step === "encrypt" ? "ENCRYPT" : "DECRYPT",
        }),
      ]
    : [];
  // Presentation only, never signed: the API returns its transactions later.
  const plannedRows = getPendingPlannedSteps(
    machineState.context,
    plannedStepTypes
  ).map(
    (type, index): YieldStepRow => ({
      done: false,
      id: `planned-${index}-${type}`,
      phases: idle,
      rejected: false,
      type,
    })
  );
  const transactionRows = flattenTransactionWorkflowTransactions(
    machineState.context
  ).flatMap(
    (transaction): ReadonlyArray<YieldStepRow> =>
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
  // A finalize sits after the unwrap it decrypts, before what it prepared.
  const actionRows = finalize
    ? [
        ...transactionRows.slice(0, finalize.position),
        toPreparationRow(machineState, {
          done: finalize.done,
          id: "finalize-decrypt",
          type: "DECRYPT",
        }),
        ...transactionRows.slice(finalize.position),
      ]
    : transactionRows;
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
    txStates: [...preparationRows, ...actionRows, ...plannedRows],
    yieldId,
  } as const;
};
