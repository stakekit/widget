import { Data, type Duration } from "effect";
import type {
  ActionTransaction,
  YieldAction,
} from "../../../domain/schema/action-models";

import type { ActionMeta } from "../../../domain/types/wallets/generic-wallet";

type StepsTransactionMeta = {
  readonly broadcasted: boolean | null;
  readonly done: boolean;
  readonly signError: StepsSignError | null;
  readonly signedTx: string | null;
  readonly txCheckError: StepsConfirmationError | null;
  readonly url: string | null;
};

export type StepsTransactionState = {
  readonly meta: StepsTransactionMeta;
  readonly tx: ActionTransaction;
};

export type StepsMachineContext = {
  readonly currentTxIndex: number | null;
  readonly txStates: ReadonlyArray<StepsTransactionState>;
  readonly yieldId: YieldAction["yieldId"];
};

type StepsState<Tag extends string> = {
  readonly _tag: Tag;
  readonly context: StepsMachineContext;
};

export type StepsMachineState =
  | StepsState<"Disabled">
  | StepsState<"Idle">
  | StepsState<"Signing">
  | (StepsState<"SignFailed"> & { readonly error: StepsSignError })
  | StepsState<"Submitting">
  | (StepsState<"SubmissionFailed"> & {
      readonly error: StepsSubmissionError;
    })
  | StepsState<"Confirming">
  | (StepsState<"ConfirmationFailed"> & {
      readonly error: StepsConfirmationError;
    })
  | StepsState<"Completed">;

export type StepsMachineCommand =
  | { readonly _tag: "Start" }
  | { readonly _tag: "RetrySign" }
  | { readonly _tag: "RetrySubmission" }
  | { readonly _tag: "RetryConfirmation" };

export type StepsMachineAction = "sign" | "submit" | "confirm";

type PhaseErrorFields = {
  readonly cause?: unknown;
  readonly message: string;
  readonly transactionId: string;
};

export class StepsSignError extends Data.TaggedError("StepsSignError")<
  PhaseErrorFields & {
    readonly customMessage: string | null;
    readonly network: string;
  }
> {}

export class StepsSubmissionError extends Data.TaggedError(
  "StepsSubmissionError"
)<PhaseErrorFields & { readonly broadcasted: boolean }> {}

export class StepsConfirmationError extends Data.TaggedError(
  "StepsConfirmationError"
)<PhaseErrorFields & { readonly network: string }> {}

export class StepsMachineInvariantError extends Data.TaggedError(
  "StepsMachineInvariantError"
)<{
  readonly message: string;
}> {}

export class StepsMachineKey extends Data.Class<{
  readonly actionMeta: ActionMeta;
  readonly confirmationPollAttempts?: number;
  readonly confirmationPollInterval?: Duration.Duration;
  readonly transactions: YieldAction["transactions"];
  readonly yieldId: YieldAction["yieldId"];
}> {}

const toTransactionState = (
  transaction: ActionTransaction
): StepsTransactionState => ({
  tx: transaction,
  meta: {
    broadcasted:
      transaction.status === "BROADCASTED" || transaction.status === "CONFIRMED"
        ? true
        : null,
    done:
      transaction.status === "CONFIRMED" || transaction.status === "SKIPPED",
    signError: null,
    signedTx: null,
    txCheckError: null,
    url: transaction.explorerUrl ?? null,
  },
});

export const initializeStepsMachine = ({
  transactions,
  yieldId,
}: Pick<StepsMachineKey, "transactions" | "yieldId">): StepsMachineState => {
  const txStates = [...transactions]
    .sort((first, second) => (first.stepIndex ?? 0) - (second.stepIndex ?? 0))
    .map(toTransactionState);
  const currentTxIndex = txStates.findIndex(({ meta }) => !meta.done);
  const context: StepsMachineContext = {
    currentTxIndex: currentTxIndex === -1 ? null : currentTxIndex,
    txStates,
    yieldId,
  };

  return currentTxIndex === -1
    ? { _tag: "Disabled", context }
    : { _tag: "Idle", context };
};

export const getStepsMachineAction = ({
  command,
  state,
}: {
  readonly command: StepsMachineCommand;
  readonly state: StepsMachineState;
}): StepsMachineAction | null => {
  switch (command._tag) {
    case "Start":
      return state._tag === "Idle" ? "sign" : null;
    case "RetrySign":
      return state._tag === "SignFailed" ? "sign" : null;
    case "RetrySubmission":
      return state._tag === "SubmissionFailed" ? "submit" : null;
    case "RetryConfirmation":
      return state._tag === "ConfirmationFailed" ? "confirm" : null;
  }
};

export const getCurrentStepsTransaction = (
  context: StepsMachineContext
): StepsTransactionState | null =>
  context.currentTxIndex === null
    ? null
    : (context.txStates[context.currentTxIndex] ?? null);

export const updateCurrentStepsTransaction = ({
  context,
  update,
}: {
  readonly context: StepsMachineContext;
  readonly update: (current: StepsTransactionState) => StepsTransactionState;
}): StepsMachineContext => {
  if (context.currentTxIndex === null) return context;

  return {
    ...context,
    txStates: context.txStates.map((transaction, index) =>
      index === context.currentTxIndex ? update(transaction) : transaction
    ),
  };
};
