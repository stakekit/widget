import { Data } from "effect";
import type {
  Action as BorrowAction,
  Transaction as BorrowTransaction,
} from "../../domain/borrow";
import type {
  ActionTransaction,
  YieldAction,
} from "../../domain/schema/action-models";
import type { ActionMeta } from "../../public-api/types";
import type { WalletScopeKey } from "../wallet/domain/scope";

export class ClassicTransactionWorkflowKey extends Data.TaggedClass("Classic")<{
  readonly actionMeta: ActionMeta;
  readonly transactions: YieldAction["transactions"];
  readonly walletScope: WalletScopeKey;
  readonly yieldId: YieldAction["yieldId"];
}> {}

export type ClassicTransactionWorkflowProviderDetail = {
  readonly address?: string;
  readonly logo?: string;
  readonly name: string;
  readonly rewardRate?: number;
  readonly rewardType?: string;
  readonly website?: string;
};

export const makeClassicTransactionWorkflowKey = ({
  action,
  inputToken,
  providersDetails,
  walletScope,
}: {
  readonly action: YieldAction;
  readonly inputToken: ActionMeta["inputToken"];
  readonly providersDetails:
    | ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
    | null
    | undefined;
  readonly walletScope: WalletScopeKey;
}) =>
  new ClassicTransactionWorkflowKey({
    actionMeta: {
      actionId: action.id,
      actionType: action.type,
      address: action.address,
      amount: action.amount,
      amountRaw: action.amountRaw,
      rawArguments: action.rawArguments,
      yieldId: action.yieldId,
      inputToken,
      providersDetails:
        providersDetails?.map((provider) => ({
          name: provider.name,
          address: provider.address,
          rewardRate: provider.rewardRate,
          rewardType: provider.rewardType,
          website: provider.website,
          logo: provider.logo,
        })) ?? [],
    },
    transactions: action.transactions,
    walletScope,
    yieldId: action.yieldId,
  });

export class BorrowTransactionWorkflowKey extends Data.TaggedClass("Borrow")<{
  readonly action: BorrowAction;
  readonly walletScope: WalletScopeKey;
}> {}

export type TransactionWorkflowKey =
  | ClassicTransactionWorkflowKey
  | BorrowTransactionWorkflowKey;

type TransactionWorkflowSource =
  | {
      readonly _tag: "Classic";
      readonly transaction: ActionTransaction;
    }
  | {
      readonly _tag: "Borrow";
      readonly transaction: BorrowTransaction;
    };

type WorkflowErrorFields = {
  readonly batchId: string;
  readonly cause?: unknown;
  readonly message: string;
  readonly transactionId: string | null;
  readonly workflowId: string;
};

export class TransactionSignError extends Data.TaggedError(
  "TransactionSignError"
)<
  WorkflowErrorFields & {
    readonly customMessage: string | null;
    readonly network: string;
  }
> {}

export class TransactionSubmissionError extends Data.TaggedError(
  "TransactionSubmissionError"
)<WorkflowErrorFields & { readonly broadcasted: boolean }> {}

export class TransactionConfirmationError extends Data.TaggedError(
  "TransactionConfirmationError"
)<WorkflowErrorFields & { readonly network: string }> {}

export class TransactionAdvanceError extends Data.TaggedError(
  "TransactionAdvanceError"
)<WorkflowErrorFields> {}

export class TransactionWorkflowInvariantError extends Data.TaggedError(
  "TransactionWorkflowInvariantError"
)<{
  readonly message: string;
  readonly workflowId: string;
}> {}

export type TransactionWorkflowError =
  | TransactionSignError
  | TransactionSubmissionError
  | TransactionConfirmationError
  | TransactionAdvanceError;

export type TransactionWorkflowSubmission = {
  readonly batchId: string;
  readonly hash: string | null;
  readonly link: string | null;
  readonly signedPayload: string | null;
  readonly source: TransactionWorkflowSource;
  readonly status: string | null;
  readonly transactionId: string;
};

export type TransactionWorkflowTransactionMeta = {
  readonly broadcasted: boolean | null;
  readonly confirmationError: TransactionConfirmationError | null;
  readonly done: boolean;
  readonly signError: TransactionSignError | null;
  readonly signedTx: string | null;
  readonly submissionIndex: number | null;
  readonly url: string | null;
};

type TransactionWorkflowTransaction = {
  readonly meta: TransactionWorkflowTransactionMeta;
  readonly source: TransactionWorkflowSource;
};

export type TransactionWorkflowTransactionFor<
  Kind extends TransactionWorkflowSource["_tag"],
> = Omit<TransactionWorkflowTransaction, "source"> & {
  readonly source: Extract<TransactionWorkflowSource, { readonly _tag: Kind }>;
};

export type TransactionWorkflowBatch = {
  readonly currentStep: number;
  readonly id: string;
  readonly totalSteps: number;
  readonly transactions: ReadonlyArray<TransactionWorkflowTransaction>;
};

type TransactionWorkflowDomainContext =
  | {
      readonly _tag: "Classic";
      readonly actionMeta: ActionMeta;
      readonly yieldId: YieldAction["yieldId"];
    }
  | {
      readonly _tag: "Borrow";
      readonly action: BorrowAction;
    };

export type TransactionWorkflowContext = {
  readonly batches: ReadonlyArray<TransactionWorkflowBatch>;
  readonly currentBatchIndex: number | null;
  readonly currentTransactionIndex: number | null;
  readonly domain: TransactionWorkflowDomainContext;
  readonly submissions: ReadonlyArray<TransactionWorkflowSubmission>;
};

export type TransactionWorkflowEvent =
  | {
      readonly _tag: "TransactionWorkflowSigned";
      readonly batchId: string;
      readonly source: TransactionWorkflowSource;
      readonly transactionId: string;
      readonly workflowId: string;
    }
  | {
      readonly _tag: "TransactionWorkflowSubmitted";
      readonly context: TransactionWorkflowContext;
      readonly submission: TransactionWorkflowSubmission;
    }
  | {
      readonly _tag: "TransactionWorkflowBatchAdvanced";
      readonly batchId: string;
      readonly context: TransactionWorkflowContext;
    }
  | {
      readonly _tag: "TransactionWorkflowCompleted";
      readonly context: TransactionWorkflowContext;
    };

type WorkflowState<Tag extends string> = {
  readonly _tag: Tag;
  readonly context: TransactionWorkflowContext;
};

export type TransactionWorkflowState =
  | WorkflowState<"Disabled">
  | WorkflowState<"Signing">
  | (WorkflowState<"SignFailed"> & { readonly error: TransactionSignError })
  | WorkflowState<"Submitting">
  | (WorkflowState<"SubmissionFailed"> & {
      readonly error: TransactionSubmissionError;
    })
  | WorkflowState<"Confirming">
  | (WorkflowState<"ConfirmationFailed"> & {
      readonly error: TransactionConfirmationError;
    })
  | WorkflowState<"Advancing">
  | (WorkflowState<"AdvanceFailed"> & {
      readonly error: TransactionAdvanceError;
    })
  | WorkflowState<"Completed">;

export type TransactionWorkflowCommand = { readonly _tag: "Retry" };

export type TransactionWorkflowAction =
  | "sign"
  | "submit"
  | "confirm"
  | "advance";

const isDoneStatus = (status: string) =>
  status === "CONFIRMED" || status === "SKIPPED";

const isBroadcastStatus = (status: string) =>
  status === "BROADCASTED" || status === "CONFIRMED";

export const isTerminalBorrowActionStatus = (status: string) =>
  status === "FAILED" || status === "CANCELED" || status === "STALE";

const toTransaction = (
  source: TransactionWorkflowSource
): TransactionWorkflowTransaction => ({
  source,
  meta: {
    broadcasted: isBroadcastStatus(source.transaction.status) ? true : null,
    confirmationError: null,
    done: isDoneStatus(source.transaction.status),
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
  key: TransactionWorkflowKey
): string => (key._tag === "Classic" ? key.actionMeta.actionId : key.action.id);

const initializeTransactionWorkflowContext = (
  key: TransactionWorkflowKey
): TransactionWorkflowContext => {
  if (key._tag === "Classic") {
    const batch = makeClassicTransactionWorkflowBatch(key.transactions);
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
        actionMeta: key.actionMeta,
        yieldId: key.yieldId,
      },
      submissions: [],
    };
  }

  const batch = makeBorrowTransactionWorkflowBatch(key.action);
  const currentTransactionIndex = batch.transactions.findIndex(
    ({ meta }) => !meta.done
  );

  return {
    batches: [batch],
    currentBatchIndex: currentTransactionIndex === -1 ? null : 0,
    currentTransactionIndex:
      currentTransactionIndex === -1 ? null : currentTransactionIndex,
    domain: { _tag: "Borrow", action: key.action },
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
  key: TransactionWorkflowKey
): TransactionWorkflowState => {
  const context = initializeTransactionWorkflowContext(key);

  if (key._tag === "Borrow" && key.action.status === "SUCCESS") {
    return { _tag: "Completed", context };
  }

  const current = getCurrentTransactionWorkflowTransaction(context);

  if (!current) {
    if (key._tag === "Borrow") {
      if (key.action.hasNextStep) {
        return { _tag: "Advancing", context };
      }
    }

    return { _tag: "Disabled", context };
  }

  return shouldConfirmWithoutSigning(current)
    ? { _tag: "Confirming", context }
    : { _tag: "Signing", context };
};

export const getCurrentTransactionWorkflowBatch = (
  context: TransactionWorkflowContext
): TransactionWorkflowBatch | null =>
  context.currentBatchIndex === null
    ? null
    : (context.batches[context.currentBatchIndex] ?? null);

export const getCurrentTransactionWorkflowTransaction = (
  context: TransactionWorkflowContext
): TransactionWorkflowTransaction | null => {
  const batch = getCurrentTransactionWorkflowBatch(context);

  return batch && context.currentTransactionIndex !== null
    ? (batch.transactions[context.currentTransactionIndex] ?? null)
    : null;
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

export const flattenTransactionWorkflowTransactions = (
  context: TransactionWorkflowContext
): ReadonlyArray<TransactionWorkflowTransaction> =>
  context.batches.flatMap((batch) => batch.transactions);

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
