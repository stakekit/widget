import type BigNumber from "bignumber.js";
import { Data, Match, Ref, type Schema } from "effect";
import type { DirectTransaction } from "../../domain/action/direct-transaction";
import type {
  ActionTransaction,
  YieldAction,
} from "../../domain/action/models";
import type { Action as BorrowAction } from "../../domain/borrow/execution/action";
import type { Transaction as BorrowTransaction } from "../../domain/borrow/execution/transaction";
import type { TransactionWorkflowId } from "../../domain/identity/identifiers";
import { WalletScopeKey } from "../../domain/wallet/wallet-scope";
import { toRepresentationNumber } from "../../shared/lib/number-format";
import type { EvmRpcError } from "../evm-rpc/evm-rpc";
import { ExternalProviderError } from "../wallet/external-provider";
import type {
  WalletBroadcastError,
  WalletCapabilityUnavailableError,
  WalletDecodeError,
  WalletRequestCancelledError,
  WalletRuntimeInvariantError,
  WalletSigningError,
} from "../wallet/wallet-errors";
import type { ClassicActionMeta } from "../wallet/wallet-transactions";
import type { ConfidentialPreparation } from "../zama/zama-service";

export type DirectTransactionRecord = Readonly<{
  readonly _tag: "Confirmed" | "Sent";
  readonly hash: `0x${string}`;
  /** What was sent, so a later confirm can resume it without planning again. */
  readonly transaction: DirectTransaction;
}>;

/**
 * The Direct transactions a Flow Session already broadcast. It outlives each
 * workflow, so confirming again resumes them instead of signing them again.
 */
export type DirectTransactionLedger = Ref.Ref<
  ReadonlyMap<DirectTransaction["id"], DirectTransactionRecord>
>;

export const makeDirectTransactionLedger = (): DirectTransactionLedger =>
  Ref.makeUnsafe<ReadonlyMap<DirectTransaction["id"], DirectTransactionRecord>>(
    new Map()
  );

type ClassicTransactionWorkflowInputFields = {
  readonly actionMeta: ClassicActionMeta;
  readonly transactions: YieldAction["transactions"];
  readonly walletScope: WalletScopeKey;
  readonly yieldId: YieldAction["yieldId"];
};

export class ClassicTransactionWorkflowInput extends Data.TaggedClass(
  "Classic"
)<ClassicTransactionWorkflowInputFields> {
  constructor(input: ClassicTransactionWorkflowInputFields) {
    super({
      actionMeta: { ...input.actionMeta },
      transactions: [...input.transactions],
      walletScope: new WalletScopeKey(input.walletScope),
      yieldId: input.yieldId,
    });
  }
}

export type ClassicTransactionWorkflowProviderDetail = {
  readonly address?: string;
  readonly logo?: string;
  readonly name: string;
  readonly rewardRate?: BigNumber | number;
  readonly rewardType?: string;
  readonly website?: string;
};

type ClassicActionFacts = {
  readonly inputToken: ClassicActionMeta["inputToken"];
  readonly providersDetails:
    | ReadonlyArray<ClassicTransactionWorkflowProviderDetail>
    | null
    | undefined;
};

export const makeClassicTransactionWorkflowInput = ({
  action,
  inputToken,
  providersDetails,
  walletScope,
}: ClassicActionFacts & {
  readonly action: YieldAction;
  readonly walletScope: WalletScopeKey;
}) =>
  new ClassicTransactionWorkflowInput({
    actionMeta: {
      actionId: action.id,
      actionType: action.type,
      address: action.address,
      amount: action.amount?.toFixed() ?? null,
      amountRaw: action.amountRaw?.toString() ?? null,
      rawArguments: action.rawArguments,
      yieldId: action.yieldId,
      inputToken,
      providersDetails:
        providersDetails?.map((provider) => ({
          name: provider.name,
          address: provider.address,
          rewardRate:
            provider.rewardRate === undefined
              ? undefined
              : toRepresentationNumber(provider.rewardRate),
          rewardType: provider.rewardType,
          website: provider.website,
          logo: provider.logo,
        })) ?? [],
    },
    transactions: action.transactions,
    walletScope,
    yieldId: action.yieldId,
  });

type ConfidentialTransactionWorkflowInputFields = ClassicActionFacts & {
  /** Run after preparation, before the action's own transactions. */
  readonly conversion: ReadonlyArray<DirectTransaction>;
  readonly ledger: DirectTransactionLedger;
  readonly preparation: ConfidentialPreparation;
  readonly walletScope: WalletScopeKey;
  readonly yieldId: YieldAction["yieldId"];
};

/**
 * A Classic workflow for a confidential vault: its action exists only once
 * the workflow has encrypted or decrypted the amount and previewed it.
 */
export class ConfidentialTransactionWorkflowInput extends Data.TaggedClass(
  "Confidential"
)<ConfidentialTransactionWorkflowInputFields> {
  constructor(input: ConfidentialTransactionWorkflowInputFields) {
    super({
      conversion: [...input.conversion],
      inputToken: input.inputToken,
      ledger: input.ledger,
      preparation: input.preparation,
      providersDetails: input.providersDetails,
      walletScope: new WalletScopeKey(input.walletScope),
      yieldId: input.yieldId,
    });
  }
}

type BorrowTransactionWorkflowInputFields = {
  readonly action: BorrowAction;
  readonly walletScope: WalletScopeKey;
};

export class BorrowTransactionWorkflowInput extends Data.TaggedClass(
  "Borrow"
)<BorrowTransactionWorkflowInputFields> {
  constructor(input: BorrowTransactionWorkflowInputFields) {
    super({
      action: { ...input.action },
      walletScope: new WalletScopeKey(input.walletScope),
    });
  }
}

export type TransactionWorkflowInput =
  | ClassicTransactionWorkflowInput
  | ConfidentialTransactionWorkflowInput
  | BorrowTransactionWorkflowInput;

export class TransactionWorkflowInputError extends Data.TaggedError(
  "TransactionWorkflowInputError"
)<{
  readonly message: string;
  readonly workflowId: TransactionWorkflowId;
}> {}

/** The workflow could not prepare its action. */
export class TransactionPrepareError extends Data.TaggedError(
  "TransactionPrepareError"
)<{
  readonly cause: unknown;
  readonly message: string;
  /** False when the request itself is invalid, so retrying cannot help. */
  readonly retryable: boolean;
  readonly workflowId: TransactionWorkflowId;
}> {}

type TransactionWorkflowSource =
  | {
      readonly _tag: "Classic";
      readonly transaction: ActionTransaction;
    }
  | {
      readonly _tag: "Direct";
      readonly transaction: DirectTransaction;
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
  readonly workflowId: TransactionWorkflowId;
};

export type TransactionSignWalletOperationCause =
  | WalletBroadcastError
  | WalletCapabilityUnavailableError
  | WalletDecodeError
  | WalletRequestCancelledError
  | WalletSigningError;

export type TransactionSignFailureReason =
  | {
      readonly _tag: "WalletUnavailable";
      readonly cause?: WalletRuntimeInvariantError;
      readonly detail:
        | "account-changed"
        | "disconnected"
        | "network-changed"
        | "state-unavailable";
    }
  | { readonly _tag: "MissingUnsignedPayload" }
  | { readonly _tag: "MissingBorrowMeta" }
  | {
      readonly _tag: "UnsupportedBorrowSigningFormat";
      readonly signingFormat: Exclude<
        NonNullable<BorrowTransaction["signingFormat"]>,
        "EIP712_TYPED_DATA" | "EVM_TRANSACTION"
      >;
    }
  | { readonly _tag: "DecodeFailed"; readonly cause: Schema.SchemaError }
  /** A Direct transaction's gas or fees could not be estimated. */
  | { readonly _tag: "EstimateFailed"; readonly cause: EvmRpcError }
  /** The user declined in the wallet; nothing was signed or sent. */
  | {
      readonly _tag: "WalletRequestCancelled";
      readonly operation: "message" | "transaction" | "typed-data";
    }
  | {
      readonly _tag: "WalletOperationFailed";
      readonly cause: TransactionSignWalletOperationCause;
      readonly operation: "message" | "transaction" | "typed-data";
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
    UnsupportedBorrowSigningFormat: () =>
      "This borrow transaction requires an unsupported signing method.",
    DecodeFailed: () => "Borrow transaction payload could not be decoded.",
    EstimateFailed: () => "The transaction could not be estimated.",
    WalletRequestCancelled: () => "The request was cancelled in the wallet.",
    WalletOperationFailed: ({ operation }) =>
      Match.value(operation).pipe(
        Match.when("transaction", () => "Transaction signing failed."),
        Match.when("typed-data", () => "Typed data signing failed."),
        Match.when("message", () => "Message signing failed."),
        Match.exhaustive
      ),
  });

export class TransactionSignError extends Data.TaggedError(
  "TransactionSignError"
)<{
  readonly batchId: string;
  readonly message: string;
  readonly network: string;
  readonly reason: TransactionSignFailureReason;
  readonly transactionId: string | null;
  readonly workflowId: TransactionWorkflowId;
}> {}

export const makeTransactionSignError = (input: {
  readonly batchId: string;
  readonly network: string;
  readonly reason: TransactionSignFailureReason;
  readonly transactionId: string | null;
  readonly workflowId: TransactionWorkflowId;
}): TransactionSignError =>
  new TransactionSignError({
    ...input,
    message: transactionSignFailureMessage(input.reason),
  });

export const getTransactionSignCustomMessage = (
  error: TransactionSignError
): string | null => {
  if (error.reason._tag !== "WalletOperationFailed") {
    return null;
  }

  const walletError = error.reason.cause;
  if (walletError._tag === "WalletBroadcastError") {
    return walletError.customMessage;
  }
  if (
    walletError._tag === "WalletSigningError" &&
    walletError.cause instanceof ExternalProviderError
  ) {
    return walletError.cause.customMessage;
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
  readonly workflowId: TransactionWorkflowId;
}> {}

export type TransactionWorkflowError =
  | TransactionPrepareError
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

type TransactionWorkflowTransactionMeta = {
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
      /** Null only while a confidential workflow prepares its action. */
      readonly actionMeta: ClassicActionMeta | null;
      readonly yieldId: YieldAction["yieldId"];
    }
  | {
      readonly _tag: "Borrow";
      readonly action: BorrowAction;
    };

/** The step a confidential workflow runs to create its action. */
type TransactionWorkflowPreparation = Readonly<{
  readonly done: boolean;
  readonly step: "decrypt" | "encrypt";
}>;

export type TransactionWorkflowContext = {
  readonly batches: ReadonlyArray<TransactionWorkflowBatch>;
  readonly currentBatchIndex: number | null;
  readonly currentTransactionIndex: number | null;
  readonly domain: TransactionWorkflowDomainContext;
  readonly preparation: TransactionWorkflowPreparation | null;
  readonly submissions: ReadonlyArray<TransactionWorkflowSubmission>;
};

type WorkflowState<Tag extends string> = {
  readonly _tag: Tag;
  readonly context: TransactionWorkflowContext;
};

export type TransactionWorkflowState =
  | WorkflowState<"Disabled">
  | WorkflowState<"Preparing">
  | (WorkflowState<"PrepareFailed"> & {
      readonly error: TransactionPrepareError;
    })
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
  | "prepare"
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

export type TransactionPhaseStatus = "idle" | "active" | "failed" | "done";

/** One transaction's progress through its sign, broadcast and confirm phases. */
export type TransactionPhaseProgress = Readonly<{
  sign: TransactionPhaseStatus;
  broadcast: TransactionPhaseStatus;
  confirm: TransactionPhaseStatus;
}>;

export type TransactionStepProgress = Readonly<{
  /** The workflow is Disabled: nothing will run, unlike a transaction waiting to sign. */
  disabled: boolean;
  phases: TransactionPhaseProgress;
}>;

const toPhaseProgress = (
  sign: TransactionPhaseStatus,
  broadcast: TransactionPhaseStatus,
  confirm: TransactionPhaseStatus
): TransactionPhaseProgress => ({ broadcast, confirm, sign });

const notStarted = toPhaseProgress("idle", "idle", "idle");
const finished = toPhaseProgress("done", "done", "done");

const getCurrentTransactionPhases = (
  tag: TransactionWorkflowState["_tag"]
): TransactionPhaseProgress => {
  switch (tag) {
    case "Disabled":
    case "Preparing":
    case "PrepareFailed":
      return notStarted;
    case "Signing":
      return toPhaseProgress("active", "idle", "idle");
    case "SignFailed":
      return toPhaseProgress("failed", "idle", "idle");
    case "Submitting":
      return toPhaseProgress("done", "active", "idle");
    case "SubmissionFailed":
      return toPhaseProgress("done", "failed", "idle");
    case "Confirming":
    case "Advancing":
      return toPhaseProgress("done", "done", "active");
    case "ConfirmationFailed":
    case "AdvanceFailed":
      return toPhaseProgress("done", "done", "failed");
    case "Completed":
      return finished;
  }
};

export const getTransactionStepProgress = (
  state: TransactionWorkflowState,
  transaction: TransactionWorkflowTransaction
): TransactionStepProgress => {
  const disabled = state._tag === "Disabled";
  if (transaction.meta.done) return { disabled, phases: finished };

  const current = getCurrentTransactionWorkflowTransaction(state.context);
  return {
    disabled,
    phases:
      current?.source.transaction.id === transaction.source.transaction.id
        ? getCurrentTransactionPhases(state._tag)
        : notStarted,
  };
};
