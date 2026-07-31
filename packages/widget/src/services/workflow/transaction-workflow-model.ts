import { Data, Match, type Schema } from "effect";
import type { Action as BorrowAction } from "../../domain/borrow/execution/action";
import type { Transaction as BorrowTransaction } from "../../domain/borrow/execution/transaction";
import type {
  ActionTransaction,
  YieldAction,
} from "../../domain/schema/action-models";
import type { ActionMeta } from "../../public-api/types";
import type {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletRuntimeInvariantError,
  WalletSigningError,
} from "../wallet/domain/errors";
import { sameWalletScopeOwner, WalletScopeKey } from "../wallet/domain/scope";

type ClassicTransactionWorkflowInputFields = {
  readonly actionMeta: ActionMeta;
  readonly transactions: YieldAction["transactions"];
  readonly walletScope: WalletScopeKey;
  readonly yieldId: YieldAction["yieldId"];
};

export class ClassicTransactionWorkflowInput extends Data.TaggedClass(
  "Classic"
)<ClassicTransactionWorkflowInputFields> {
  constructor(input: ClassicTransactionWorkflowInputFields) {
    super({
      actionMeta: structuredClone(input.actionMeta),
      transactions: structuredClone(input.transactions),
      walletScope: new WalletScopeKey(input.walletScope),
      yieldId: input.yieldId,
    });
  }
}

export type ClassicTransactionWorkflowProviderDetail = {
  readonly address?: string;
  readonly logo?: string;
  readonly name: string;
  readonly rewardRate?: number;
  readonly rewardType?: string;
  readonly website?: string;
};

export const makeClassicTransactionWorkflowInput = ({
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
  new ClassicTransactionWorkflowInput({
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

type BorrowTransactionWorkflowInputFields = {
  readonly action: BorrowAction;
  readonly walletScope: WalletScopeKey;
};

export class BorrowTransactionWorkflowInput extends Data.TaggedClass(
  "Borrow"
)<BorrowTransactionWorkflowInputFields> {
  constructor(input: BorrowTransactionWorkflowInputFields) {
    super({
      action: structuredClone(input.action),
      walletScope: new WalletScopeKey(input.walletScope),
    });
  }
}

export type TransactionWorkflowInput =
  | ClassicTransactionWorkflowInput
  | BorrowTransactionWorkflowInput;

export class TransactionWorkflowInputError extends Data.TaggedError(
  "TransactionWorkflowInputError"
)<{
  readonly message: string;
  readonly workflowId: string;
}> {}

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

export type TransactionSignWalletOperationCause =
  | WalletBroadcastError
  | WalletCapabilityUnavailableError
  | WalletDecodeError
  | WalletSigningError;

export type TransactionSignFailureReason =
  | {
      readonly _tag: "WalletUnavailable";
      readonly cause?: WalletRuntimeInvariantError;
      readonly detail:
        | "account-changed"
        | "disconnected"
        | "network-changed"
        | "no-address"
        | "state-unavailable";
    }
  | { readonly _tag: "MissingUnsignedPayload" }
  | { readonly _tag: "MissingBorrowMeta" }
  | { readonly _tag: "DecodeFailed"; readonly cause: Schema.SchemaError }
  | {
      readonly _tag: "WalletOperationFailed";
      readonly cause: TransactionSignWalletOperationCause;
      readonly operation: "message" | "transaction";
    };

const transactionSignFailureMessage = (
  reason: TransactionSignFailureReason
): string =>
  Match.valueTags(reason, {
    WalletUnavailable: ({ detail }) =>
      Match.value(detail).pipe(
        Match.when(
          "state-unavailable",
          () => "Wallet state is unavailable for transaction signing."
        ),
        Match.when(
          "disconnected",
          () => "Wallet is not connected for transaction signing."
        ),
        Match.when(
          "no-address",
          () => "The transaction workflow has no wallet address."
        ),
        Match.when(
          "network-changed",
          () => "Wallet network changed during transaction execution."
        ),
        Match.when(
          "account-changed",
          () => "Wallet account changed during transaction execution."
        ),
        Match.exhaustive
      ),
    MissingUnsignedPayload: () => "The transaction has no unsigned payload.",
    MissingBorrowMeta: () =>
      "Borrow action metadata is unavailable for signing.",
    DecodeFailed: () => "Borrow transaction payload could not be decoded.",
    WalletOperationFailed: ({ operation }) =>
      operation === "message"
        ? "Message signing failed."
        : "Transaction signing failed.",
  });

export class TransactionSignError extends Data.TaggedError(
  "TransactionSignError"
)<{
  readonly batchId: string;
  readonly message: string;
  readonly network: string;
  readonly reason: TransactionSignFailureReason;
  readonly transactionId: string | null;
  readonly workflowId: string;
}> {}

export const makeTransactionSignError = (input: {
  readonly batchId: string;
  readonly network: string;
  readonly reason: TransactionSignFailureReason;
  readonly transactionId: string | null;
  readonly workflowId: string;
}): TransactionSignError =>
  new TransactionSignError({
    ...input,
    message: transactionSignFailureMessage(input.reason),
  });

export const getTransactionSignCustomMessage = (
  error: TransactionSignError
): string | null => {
  if (
    error.reason._tag === "WalletOperationFailed" &&
    error.reason.cause._tag === "WalletBroadcastError"
  ) {
    return error.reason.cause.customMessage;
  }

  return null;
};

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

type TransactionWorkflowBatch = {
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
    if (input._tag === "Borrow") {
      if (input.action.hasNextStep) {
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
