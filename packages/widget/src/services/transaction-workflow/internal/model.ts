import type { YieldAction } from "../../../domain/action/models";
import type { Action as BorrowAction } from "../../../domain/borrow/execution/action";
import { sameWalletScopeOwner } from "../../../domain/wallet/wallet-scope";
import {
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  type TransactionWorkflowAction,
  type TransactionWorkflowCommand,
  type TransactionWorkflowContext,
  type TransactionWorkflowInput,
  TransactionWorkflowInputError,
  type TransactionWorkflowState,
  type TransactionWorkflowTransactionFor,
} from "../transaction-workflow-model";

type TransactionWorkflowBatch = TransactionWorkflowContext["batches"][number];
type TransactionWorkflowTransaction =
  TransactionWorkflowBatch["transactions"][number];
type TransactionWorkflowSource = TransactionWorkflowTransaction["source"];
type TransactionWorkflowDomainContext = TransactionWorkflowContext["domain"];

export const isTransactionWorkflowDoneStatus = (status: string) =>
  status === "CONFIRMED" || status === "SKIPPED";

const isBroadcastStatus = (status: string) =>
  status === "BROADCASTED" || status === "CONFIRMED";

const toTransaction = (
  source: TransactionWorkflowSource
): TransactionWorkflowTransaction => ({
  source,
  meta: {
    broadcasted: isBroadcastStatus(source.transaction.status) ? true : null,
    confirmationError: null,
    done: isTransactionWorkflowDoneStatus(source.transaction.status),
    signError: null,
    signedTx: null,
    submissionIndex: null,
    url:
      source._tag === "Classic"
        ? (source.transaction.explorerUrl ?? null)
        : null,
  },
});

const makeClassicTransactionWorkflowBatch = (
  transactions: YieldAction["transactions"]
): TransactionWorkflowBatch => ({
  currentStep: 1,
  id: "classic",
  totalSteps: 1,
  transactions: [...transactions]
    .sort((first, second) => (first.stepIndex ?? 0) - (second.stepIndex ?? 0))
    .map((transaction) => toTransaction({ _tag: "Classic", transaction })),
});

export const makeBorrowTransactionWorkflowBatch = (
  action: BorrowAction
): TransactionWorkflowBatch => ({
  currentStep: action.currentStep,
  id: `borrow-step-${action.currentStep}`,
  totalSteps: action.totalSteps,
  transactions: action.transactions.map((transaction) =>
    toTransaction({ _tag: "Borrow", transaction })
  ),
});

export const getTransactionWorkflowId = (
  input: TransactionWorkflowInput
): string =>
  input._tag === "Classic" ? input.actionMeta.actionId : input.action.id;

export const validateTransactionWorkflowInput = (
  input: TransactionWorkflowInput
): TransactionWorkflowInputError | null => {
  const workflowId = getTransactionWorkflowId(input);
  const fail = (message: string) =>
    new TransactionWorkflowInputError({ message, workflowId });
  const actionAddress =
    input._tag === "Classic" ? input.actionMeta.address : input.action.address;

  if (!actionAddress) {
    return fail("The transaction workflow has no action wallet address.");
  }

  if (
    !sameWalletScopeOwner(input.walletScope, {
      address: actionAddress,
      network: input.walletScope.network,
    })
  ) {
    return fail(
      "The transaction workflow action does not belong to its captured wallet scope."
    );
  }

  const mismatchedNetwork =
    input._tag === "Classic"
      ? input.transactions.find(
          (transaction) => transaction.network !== input.walletScope.network
        )
      : input.action.transactions.find(
          (transaction) => transaction.network !== input.walletScope.network
        );

  if (mismatchedNetwork) {
    return fail(
      "The transaction workflow contains a transaction outside its captured wallet network."
    );
  }

  if (input._tag === "Borrow") {
    const mismatchedOwner = input.action.transactions.find(
      (transaction) =>
        !sameWalletScopeOwner(input.walletScope, {
          address: transaction.address,
          network: transaction.network,
        })
    );

    if (mismatchedOwner) {
      return fail(
        "The transaction workflow contains a transaction outside its captured wallet scope."
      );
    }
  }

  return null;
};

const initializeTransactionWorkflowContext = (
  input: TransactionWorkflowInput
): TransactionWorkflowContext => {
  if (input._tag === "Classic") {
    const batch = makeClassicTransactionWorkflowBatch(input.transactions);
    const currentTransactionIndex = batch.transactions.findIndex(
      ({ meta }) => !meta.done
    );

    return {
      batches: [batch],
      currentBatchIndex: currentTransactionIndex === -1 ? null : 0,
      currentTransactionIndex:
        currentTransactionIndex === -1 ? null : currentTransactionIndex,
      domain: {
        _tag: "Classic",
        actionMeta: input.actionMeta,
        yieldId: input.yieldId,
      },
      submissions: [],
    };
  }

  const batch = makeBorrowTransactionWorkflowBatch(input.action);
  const currentTransactionIndex = batch.transactions.findIndex(
    ({ meta }) => !meta.done
  );

  return {
    batches: [batch],
    currentBatchIndex: currentTransactionIndex === -1 ? null : 0,
    currentTransactionIndex:
      currentTransactionIndex === -1 ? null : currentTransactionIndex,
    domain: { _tag: "Borrow", action: input.action },
    submissions: [],
  };
};

const shouldConfirmWithoutSigning = (
  transaction: TransactionWorkflowTransaction
) =>
  transaction.meta.broadcasted === true ||
  (transaction.source._tag === "Borrow" &&
    transaction.source.transaction.signablePayload == null);

export const initializeTransactionWorkflow = (
  input: TransactionWorkflowInput
): TransactionWorkflowState => {
  const context = initializeTransactionWorkflowContext(input);

  if (input._tag === "Borrow" && input.action.status === "SUCCESS") {
    return { _tag: "Completed", context };
  }

  const current = getCurrentTransactionWorkflowTransaction(context);

  if (!current) {
    if (input._tag === "Borrow" && input.action.hasNextStep) {
      return { _tag: "Advancing", context };
    }

    return { _tag: "Disabled", context };
  }

  return shouldConfirmWithoutSigning(current)
    ? { _tag: "Confirming", context }
    : { _tag: "Signing", context };
};

export function getCurrentTransactionWorkflowTransactionFor(
  context: TransactionWorkflowContext,
  kind: "Classic"
): TransactionWorkflowTransactionFor<"Classic"> | null;
export function getCurrentTransactionWorkflowTransactionFor(
  context: TransactionWorkflowContext,
  kind: "Borrow"
): TransactionWorkflowTransactionFor<"Borrow"> | null;
export function getCurrentTransactionWorkflowTransactionFor(
  context: TransactionWorkflowContext,
  kind: TransactionWorkflowSource["_tag"]
): TransactionWorkflowTransaction | null {
  const current = getCurrentTransactionWorkflowTransaction(context);

  return current?.source._tag === kind ? current : null;
}

export const updateCurrentTransactionWorkflowTransaction = ({
  context,
  update,
}: {
  readonly context: TransactionWorkflowContext;
  readonly update: (
    current: TransactionWorkflowTransaction
  ) => TransactionWorkflowTransaction;
}): TransactionWorkflowContext => {
  if (
    context.currentBatchIndex === null ||
    context.currentTransactionIndex === null
  ) {
    return context;
  }

  return {
    ...context,
    batches: context.batches.map((batch, batchIndex) =>
      batchIndex === context.currentBatchIndex
        ? {
            ...batch,
            transactions: batch.transactions.map((transaction, index) =>
              index === context.currentTransactionIndex
                ? update(transaction)
                : transaction
            ),
          }
        : batch
    ),
  };
};

export const selectNextTransactionWorkflowTransaction = (
  context: TransactionWorkflowContext
): TransactionWorkflowContext => {
  const batch = getCurrentTransactionWorkflowBatch(context);

  if (!batch) return context;

  const currentIndex = context.currentTransactionIndex ?? -1;
  const nextIndex = batch.transactions.findIndex(
    ({ meta }, index) => index > currentIndex && !meta.done
  );

  return {
    ...context,
    currentTransactionIndex: nextIndex === -1 ? null : nextIndex,
  };
};

export const appendTransactionWorkflowBatch = ({
  batch,
  context,
  domain,
}: {
  readonly batch: TransactionWorkflowBatch;
  readonly context: TransactionWorkflowContext;
  readonly domain: TransactionWorkflowDomainContext;
}): TransactionWorkflowContext => {
  const existingIndex = context.batches.findIndex(
    (candidate) => candidate.id === batch.id
  );
  const batches =
    existingIndex === -1 ? [...context.batches, batch] : context.batches;
  const batchIndex = existingIndex === -1 ? batches.length - 1 : existingIndex;
  const currentTransactionIndex = batches[batchIndex]?.transactions.findIndex(
    ({ meta }) => !meta.done
  );

  return {
    ...context,
    batches,
    currentBatchIndex: batchIndex,
    currentTransactionIndex:
      currentTransactionIndex == null || currentTransactionIndex === -1
        ? null
        : currentTransactionIndex,
    domain,
  };
};

export const getTransactionWorkflowAction = ({
  command,
  state,
}: {
  readonly command: TransactionWorkflowCommand;
  readonly state: TransactionWorkflowState;
}): TransactionWorkflowAction | null => {
  if (command._tag !== "Retry") return null;

  switch (state._tag) {
    case "SignFailed":
      return "sign";
    case "SubmissionFailed":
      return "submit";
    case "ConfirmationFailed":
      return "confirm";
    case "AdvanceFailed":
      return "advance";
    case "Disabled":
    case "Signing":
    case "Submitting":
    case "Confirming":
    case "Advancing":
    case "Completed":
      return null;
  }
};
