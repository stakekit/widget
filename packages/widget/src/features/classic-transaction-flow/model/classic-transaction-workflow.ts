import type { TFunction } from "i18next";
import type { YieldAction } from "../../../domain/action/models";
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
  type: TransactionType | "DECRYPT" | "ENCRYPT",
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
            progress: getTransactionStepProgress(machineState, transaction),
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

export type ClassicFlowConversionStepStatus =
  | "confirming"
  | "done"
  | "failed"
  | "idle"
  | "rejected"
  | "signing";

export type ClassicFlowConversion = Readonly<{
  readonly steps: ReadonlyArray<
    Readonly<{
      readonly status: ClassicFlowConversionStepStatus;
      readonly step: "approve" | "decrypt" | "encrypt" | "wrap";
    }>
  >;
  readonly transactions: YieldAction["transactions"];
}>;

const idle = { broadcast: "idle", confirm: "idle", sign: "idle" } as const;

const conversionStepPhases: Record<
  ClassicFlowConversionStepStatus,
  TransactionPhaseProgress
> = {
  confirming: { broadcast: "done", confirm: "active", sign: "done" },
  done: { broadcast: "done", confirm: "done", sign: "done" },
  failed: { ...idle, sign: "failed" },
  idle,
  rejected: { ...idle, sign: "failed" },
  signing: { ...idle, sign: "active" },
};

const conversionStepTypes = {
  approve: "APPROVAL",
  decrypt: "DECRYPT",
  encrypt: "ENCRYPT",
  wrap: "WRAP",
} as const;

export const getClassicConversionStepsView = (
  conversion: ClassicFlowConversion,
  engine: ReturnType<typeof getClassicTransactionStepsView> | null,
  yieldId: YieldAction["yieldId"]
) => ({
  cancelled: engine?.cancelled ?? false,
  customSignErrorMessage: engine?.customSignErrorMessage ?? null,
  retryable:
    conversion.steps.some((step) => step.status === "failed") ||
    (engine?.retryable ?? false),
  txStates: [
    ...conversion.steps.map((step) => ({
      meta: {
        done: step.status === "done",
        rejected: step.status === "rejected",
      },
      progress: { disabled: false, phases: conversionStepPhases[step.status] },
      tx: {
        id: `conversion-${step.step}`,
        type: conversionStepTypes[step.step],
      },
    })),
    ...(engine?.txStates ??
      conversion.transactions.map((tx) => ({
        meta: { done: false },
        progress: { disabled: false, phases: idle },
        tx,
      }))),
  ],
  yieldId,
});
