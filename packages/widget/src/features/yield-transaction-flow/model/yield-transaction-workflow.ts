import type { TFunction } from "i18next";
import type { DirectTransaction } from "../../../domain/action/direct-transaction";
import type { YieldAction } from "../../../domain/action/models";
import type {
  TransactionStatus,
  TransactionType,
} from "../../../domain/action/rules";
import type { TransactionHash } from "../../../domain/identity/identifiers";
import type {
  TransactionPhaseProgress,
  TransactionWorkflowContext,
  TransactionWorkflowState,
  YieldTransactionWorkflowInput,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import {
  flattenTransactionWorkflowTransactions,
  getTransactionStepProgress,
  getTransactionWorkflowTransactionReference,
} from "../../../services/transaction-workflow/transaction-workflow-model";
import { sentenceCaseEnumValue } from "../../../shared/lib/formatters";

export type YieldTransactionCompletionUrl = {
  readonly type: TransactionType;
  readonly url: string;
  /** The sent transaction's hash, when the workflow knows it. */
  readonly hash: TransactionHash | null;
};

export const formatTransactionTypeLabel = (
  type: TransactionType | "DECRYPT" | "ENCRYPT" | "RESET_APPROVAL",
  t: TFunction,
  options?: { readonly context?: "ETHENA_USDE" | undefined }
) =>
  t(`steps.tx_type.${type}`, {
    context: options?.context,
    defaultValue: sentenceCaseEnumValue(type),
  });

/** Whether the wallet still signs a transaction in each status. */
const awaitsSignature: Record<TransactionStatus, boolean> = {
  BLOCKED: true,
  BROADCASTED: false,
  CONFIRMED: false,
  CREATED: true,
  FAILED: true,
  NOT_FOUND: true,
  PENDING: false,
  SIGNED: false,
  SKIPPED: false,
  WAITING_FOR_SIGNATURE: true,
};

/** A transaction the wallet signs: an action's, or a planned conversion's. */
export type YieldFlowTransactionToSign =
  | TransactionType
  | DirectTransaction["type"];

/**
 * The transactions the wallet still signs for an action, in order: the
 * approve and wrap planned before it, then its own not yet signed.
 */
export const getYieldFlowTransactionsToSign = (
  action: Pick<YieldAction, "transactions">,
  conversion: ReadonlyArray<Pick<DirectTransaction, "type">>
): ReadonlyArray<YieldFlowTransactionToSign> => [
  ...conversion.map(({ type }) => type),
  ...action.transactions
    .filter(({ status }) => awaitsSignature[status])
    .map(({ type }) => type),
];

export const getYieldTransactionCompletionUrls = (
  context: TransactionWorkflowContext
): ReadonlyArray<YieldTransactionCompletionUrl> =>
  flattenTransactionWorkflowTransactions(context).flatMap(
    (transaction): ReadonlyArray<YieldTransactionCompletionUrl> =>
      transaction.source._tag === "Yield" && transaction.meta.url
        ? [
            {
              hash: getTransactionWorkflowTransactionReference(
                context,
                transaction
              ).hash,
              type: transaction.source.transaction.type,
              url: transaction.meta.url,
            },
          ]
        : []
  );

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
  /** The transaction on a block explorer, once it has been sent. */
  readonly explorerUrl: string | null;
  /** The sent transaction's hash, once it has one. */
  readonly hash: TransactionHash | null;
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
  explorerUrl: null,
  hash: null,
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
      explorerUrl: null,
      hash: null,
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
              ...getTransactionWorkflowTransactionReference(
                machineState.context,
                transaction
              ),
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
  return {
    /** What failed, while the workflow waits on Retry. */
    error: "error" in machineState ? machineState.error : null,
    /** Headers count the steps only when the list is known upfront. */
    numbered: preparation === null,
    /**
     * An API transaction confirmed, so the action waits for its next one
     * and Activity offers Continue. A preparation, a direct transaction or
     * a skipped approval leaves the API action untouched.
     */
    resumable: flattenTransactionWorkflowTransactions(
      machineState.context
    ).some(({ meta, source }) => source._tag === "Yield" && meta.done),
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
