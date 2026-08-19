import { Data, Match, type Schema } from "effect";
import type {
  ActionTransaction,
  YieldAction,
} from "../../domain/action/models";
import type { Action as BorrowAction } from "../../domain/borrow/execution/action";
import type { Transaction as BorrowTransaction } from "../../domain/borrow/execution/transaction";
import { WalletScopeKey } from "../../domain/wallet/wallet-scope";
import type { ActionMeta } from "../../public-api/types";
import type {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletRuntimeInvariantError,
  WalletSigningError,
} from "../wallet/wallet-errors";

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

export const flattenTransactionWorkflowTransactions = (
  context: TransactionWorkflowContext
): ReadonlyArray<TransactionWorkflowTransaction> =>
  context.batches.flatMap((batch) => batch.transactions);
