import {
  Data,
  Duration,
  Effect,
  Match,
  Ref,
  Schedule,
  Schema,
  Stream,
} from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import {
  Action,
  type ActionRequest,
  SubmitTransactionResult,
  type Transaction,
} from "../domain";
import {
  BorrowActionCompletionFailedError,
  BorrowActionStepFailedError,
  BorrowApiService,
  BorrowCheckFailedError,
  BorrowExecutionEventsService,
  type BorrowExecutionPhase,
  type BorrowExecutionResult,
  BorrowMutationApiService,
  type BorrowSignedTransaction,
  BorrowSubmitFailedError,
  type BorrowSubmittedTransaction,
  type BorrowTransactionExecutionError,
  BorrowTransactionFailedError,
  BorrowTransactionNotConfirmedError,
  BorrowWalletExecutionService,
  borrowAtomRuntime,
  decodeBorrowEvmTransactionForWallet,
  getBorrowSubmittedTransaction,
  getBorrowTransactionMeta,
  getBorrowTransactionSubmitPayload,
} from "../runtime";

export type BorrowExecutionStepId = "create" | "sign" | "submit" | "confirm";

export type BorrowExecutionStepStatus =
  | "pending"
  | "active"
  | "completed"
  | "failed";

export type BorrowExecutionStep = {
  readonly id: BorrowExecutionStepId;
  readonly status: BorrowExecutionStepStatus;
};

export class BorrowExecutionKey extends Data.Class<{
  readonly action: Action;
  readonly confirmationPollAttempts?: number;
  readonly confirmationPollIntervalMs?: number;
}> {}

export type BorrowExecutionMachineState = {
  readonly action: Action;
  readonly currentTxIndex: number;
  readonly isDone: boolean;
  readonly phase: BorrowExecutionPhase;
  readonly submissions: ReadonlyArray<BorrowSubmittedTransaction>;
  readonly transactions: ReadonlyArray<Transaction>;
} & (
  | {
      readonly signedTransaction: null;
      readonly step: "sign" | "step" | null;
    }
  | {
      readonly signedTransaction: BorrowSignedTransaction;
      readonly step: "submit" | "check";
    }
);

const stepOrder: Record<BorrowExecutionStepId, number> = {
  create: 0,
  sign: 1,
  submit: 2,
  confirm: 3,
};

const phaseToStepId = (phase: BorrowExecutionPhase): BorrowExecutionStepId => {
  switch (phase) {
    case "creating":
      return "create";
    case "signing":
      return "sign";
    case "submitting":
      return "submit";
    case "confirming":
    case "stepping":
    case "completed":
      return "confirm";
  }
};

export const getBorrowExecutionSteps = ({
  error,
  phase,
}: {
  readonly error: BorrowTransactionExecutionError | null;
  readonly phase: BorrowExecutionPhase;
}): ReadonlyArray<BorrowExecutionStep> => {
  const activeStepId = phaseToStepId(phase);
  const activeStepOrder = stepOrder[activeStepId];
  const failedStepId = error ? phaseToStepId(error.phase) : null;

  return (Object.keys(stepOrder) as BorrowExecutionStepId[]).map((id) => {
    if (failedStepId === id) {
      return { id, status: "failed" };
    }

    if (phase === "completed" || stepOrder[id] < activeStepOrder) {
      return { id, status: "completed" };
    }

    if (id === activeStepId) {
      return { id, status: "active" };
    }

    return { id, status: "pending" };
  });
};

const decodeBorrowAction = ({
  actionId,
  input,
  phase,
}: {
  readonly actionId?: string;
  readonly input: unknown;
  readonly phase: BorrowExecutionPhase;
}) =>
  Schema.decodeUnknownEffect(Action)(input).pipe(
    Effect.mapError(
      (cause) =>
        new BorrowActionCompletionFailedError({
          actionId,
          cause,
          message: "Borrow action response could not be decoded.",
          phase,
        })
    )
  );

const getActionFailureMessage = (action: Action) =>
  `Borrow action ended with ${action.status} status.`;

const failIfActionTerminal = (action: Action, phase: BorrowExecutionPhase) => {
  if (
    action.status === "FAILED" ||
    action.status === "CANCELED" ||
    action.status === "STALE"
  ) {
    return Effect.fail(
      new BorrowActionCompletionFailedError({
        actionId: action.id,
        message: getActionFailureMessage(action),
        phase,
      })
    );
  }

  return Effect.void;
};

const isTransactionConfirmed = (transaction: Transaction) =>
  transaction.status === "CONFIRMED" || transaction.status === "SKIPPED";

const getCurrentTransaction = (state: BorrowExecutionMachineState) => {
  const transaction = state.transactions[state.currentTxIndex];

  return transaction
    ? Effect.succeed(transaction)
    : Effect.fail(
        new BorrowActionCompletionFailedError({
          actionId: state.action.id,
          message: "Borrow action has no transaction to process.",
          phase: state.phase,
        })
      );
};

const getSignedTransaction = (
  state: BorrowExecutionMachineState,
  transaction: Transaction
) =>
  state.signedTransaction
    ? Effect.succeed(state.signedTransaction)
    : Effect.fail(
        new BorrowSubmitFailedError({
          actionId: state.action.id,
          message: "Signed borrow transaction is not available.",
          phase: "submitting",
          transactionId: transaction.id,
        })
      );

const completeState = (
  state: BorrowExecutionMachineState,
  action: Action
): BorrowExecutionMachineState => ({
  ...state,
  action,
  isDone: true,
  phase: "completed",
  signedTransaction: null,
  step: null,
  transactions: action.transactions,
});

const advanceToNextTransaction = ({
  state,
  updatedAction,
}: {
  readonly state: BorrowExecutionMachineState;
  readonly updatedAction: Action;
}): BorrowExecutionMachineState => {
  const transactions = state.transactions.map(
    (transaction) =>
      updatedAction.transactions.find((next) => next.id === transaction.id) ??
      transaction
  );

  if (updatedAction.status === "SUCCESS") {
    return completeState(
      {
        ...state,
        transactions,
      },
      updatedAction
    );
  }

  if (state.currentTxIndex < transactions.length - 1) {
    return {
      ...state,
      action: updatedAction,
      currentTxIndex: state.currentTxIndex + 1,
      phase: "signing",
      signedTransaction: null,
      step: null,
      transactions,
    };
  }

  if (updatedAction.hasNextStep) {
    return {
      ...state,
      action: updatedAction,
      phase: "stepping",
      signedTransaction: null,
      step: "step",
      transactions,
    };
  }

  return completeState(
    {
      ...state,
      transactions,
    },
    updatedAction
  );
};

const createBorrowAction = ({ request }: { readonly request: ActionRequest }) =>
  Effect.gen(function* () {
    const api = yield* BorrowMutationApiService;
    const response = yield* api
      .ActionsControllerExecuteActionV1({ payload: request })
      .pipe(
        Effect.mapError(
          (cause) =>
            new BorrowActionCompletionFailedError({
              cause,
              message: "Borrow action could not be created.",
              phase: "creating",
            })
        )
      );

    const action = yield* decodeBorrowAction({
      input: response,
      phase: "creating",
    });

    yield* failIfActionTerminal(action, "creating");

    return action;
  });

const checkBorrowTransaction = ({
  action,
  intervalMs,
  times,
  transaction,
}: {
  readonly action: Action;
  readonly intervalMs: number;
  readonly times: number;
  readonly transaction: Transaction;
}) =>
  Effect.gen(function* () {
    const api = yield* BorrowApiService;
    const response = yield* api
      .ActionsControllerGetActionV1(action.id, undefined)
      .pipe(
        Effect.mapError(
          (cause) =>
            new BorrowCheckFailedError({
              actionId: action.id,
              cause,
              message: "Borrow action status could not be checked.",
              phase: "confirming",
              transactionId: transaction.id,
            })
        )
      );

    if (!response) {
      return yield* new BorrowCheckFailedError({
        actionId: action.id,
        message: "Borrow action was not found.",
        phase: "confirming",
        transactionId: transaction.id,
      });
    }

    const updatedAction = yield* decodeBorrowAction({
      actionId: action.id,
      input: response,
      phase: "confirming",
    });

    yield* failIfActionTerminal(updatedAction, "confirming");

    if (updatedAction.status === "SUCCESS") {
      return updatedAction;
    }

    const updatedTransaction = updatedAction.transactions.find(
      (candidate) => candidate.id === transaction.id
    );

    if (!updatedTransaction) {
      return yield* new BorrowCheckFailedError({
        actionId: action.id,
        message: "Borrow transaction was not present in the action response.",
        phase: "confirming",
        transactionId: transaction.id,
      });
    }

    if (isTransactionConfirmed(updatedTransaction)) {
      return updatedAction;
    }

    if (
      updatedTransaction.status === "FAILED" ||
      updatedTransaction.status === "NOT_FOUND"
    ) {
      return yield* new BorrowTransactionFailedError({
        actionId: action.id,
        message: `Borrow transaction ended with ${updatedTransaction.status} status.`,
        phase: "confirming",
        transactionId: transaction.id,
      });
    }

    return yield* new BorrowTransactionNotConfirmedError({
      actionId: action.id,
      message: "Borrow transaction is not confirmed yet.",
      phase: "confirming",
      transactionId: transaction.id,
    });
  }).pipe(
    Effect.retry({
      schedule: Schedule.spaced(Duration.millis(intervalMs)),
      times,
      while: (error) => error._tag === "BorrowTransactionNotConfirmedError",
    })
  );

const stepBorrowAction = (state: BorrowExecutionMachineState) =>
  Effect.gen(function* () {
    const api = yield* BorrowMutationApiService;
    const response = yield* api
      .ActionsControllerStepV1(state.action.id, undefined)
      .pipe(
        Effect.mapError(
          (cause) =>
            new BorrowActionStepFailedError({
              actionId: state.action.id,
              cause,
              message: "Borrow action could not advance to the next step.",
              phase: "stepping",
            })
        )
      );
    const action = yield* decodeBorrowAction({
      actionId: state.action.id,
      input: response,
      phase: "stepping",
    });

    yield* failIfActionTerminal(action, "stepping");

    if (action.status === "SUCCESS") {
      return completeState(state, action);
    }

    return {
      ...state,
      action,
      currentTxIndex: 0,
      phase: "signing",
      signedTransaction: null,
      step: null,
      transactions: action.transactions,
    } satisfies BorrowExecutionMachineState;
  });

const processBorrowExecutionStep = ({
  intervalMs,
  stateRef,
  times,
}: {
  readonly intervalMs: number;
  readonly stateRef: Ref.Ref<BorrowExecutionMachineState>;
  readonly times: number;
}) =>
  Effect.gen(function* () {
    const wallet = yield* BorrowWalletExecutionService;
    const events = yield* BorrowExecutionEventsService;
    const state = yield* Ref.get(stateRef);

    if (state.isDone || state.action.status === "SUCCESS") {
      const doneState = completeState(state, state.action);

      yield* Ref.set(stateRef, doneState);
      return doneState;
    }

    yield* failIfActionTerminal(state.action, state.phase);

    if (state.step === "step") {
      const result = yield* stepBorrowAction(state);

      yield* Ref.set(stateRef, result);
      return result;
    }

    if (state.transactions.length === 0) {
      if (state.action.hasNextStep) {
        const result = yield* stepBorrowAction({
          ...state,
          phase: "stepping",
          signedTransaction: null,
          step: "step",
        });

        yield* Ref.set(stateRef, result);
        return result;
      }

      return yield* new BorrowActionCompletionFailedError({
        actionId: state.action.id,
        message: "Borrow action completed without a success status.",
        phase: state.phase,
      });
    }

    const transaction = yield* getCurrentTransaction(state);

    if (!transaction.signablePayload || isTransactionConfirmed(transaction)) {
      const updatedAction = yield* checkBorrowTransaction({
        action: state.action,
        intervalMs,
        times,
        transaction,
      });
      const result = advanceToNextTransaction({
        state,
        updatedAction,
      });

      yield* Ref.set(stateRef, result);
      return result;
    }

    const result = yield* Match.value(state.step).pipe(
      Match.when(null, () =>
        Effect.succeed({
          ...state,
          phase: "signing" as const,
          signedTransaction: null,
          step: "sign" as const,
        })
      ),
      Match.when("sign", () =>
        Effect.gen(function* () {
          const tx = yield* decodeBorrowEvmTransactionForWallet({
            action: state.action,
            transaction,
          });
          const signedTransaction = yield* wallet.signTransaction({
            action: state.action,
            network: transaction.network,
            transaction,
            tx,
            txMeta: getBorrowTransactionMeta({
              action: state.action,
              transaction,
            }),
          });

          return {
            ...state,
            phase: "submitting" as const,
            signedTransaction,
            step: "submit" as const,
          };
        })
      ),
      Match.when("submit", () =>
        Effect.gen(function* () {
          const api = yield* BorrowMutationApiService;
          const signedTransaction = yield* getSignedTransaction(
            state,
            transaction
          );
          const response = yield* api
            .TransactionsControllerSubmitTransactionV1(transaction.id, {
              payload: getBorrowTransactionSubmitPayload(signedTransaction),
            })
            .pipe(
              Effect.mapError(
                (cause) =>
                  new BorrowSubmitFailedError({
                    actionId: state.action.id,
                    cause,
                    message: "Borrow transaction could not be submitted.",
                    phase: "submitting",
                    transactionId: transaction.id,
                  })
              )
            );
          const decodedResponse = yield* Schema.decodeUnknownEffect(
            SubmitTransactionResult
          )(response).pipe(
            Effect.mapError(
              (cause) =>
                new BorrowSubmitFailedError({
                  actionId: state.action.id,
                  cause,
                  message: "Borrow submission response could not be decoded.",
                  phase: "submitting",
                  transactionId: transaction.id,
                })
            )
          );
          const submission = getBorrowSubmittedTransaction({
            response: decodedResponse,
            signedTransaction,
            transaction,
          });
          const submissions = [...state.submissions, submission];

          yield* events.publish({
            _tag: "BorrowTransactionSubmitted",
            action: state.action,
            submissions,
            transaction,
          });

          return {
            ...state,
            phase: "confirming" as const,
            signedTransaction,
            submissions,
            step: "check" as const,
          };
        })
      ),
      Match.when("check", () =>
        Effect.gen(function* () {
          const updatedAction = yield* checkBorrowTransaction({
            action: state.action,
            intervalMs,
            times,
            transaction,
          });

          return advanceToNextTransaction({
            state,
            updatedAction,
          });
        })
      ),
      Match.exhaustive
    );

    yield* Ref.set(stateRef, result);

    if (result.isDone) {
      yield* events.publish({
        _tag: "BorrowActionCompleted",
        action: result.action,
        submissions: result.submissions,
      });
    }

    return result;
  });

export const borrowCreateActionAtom = borrowAtomRuntime.fn(
  (request: ActionRequest) => createBorrowAction({ request })
);

export const borrowExecutionAtom = Atom.family((key: BorrowExecutionKey) => {
  const machineAtom = borrowAtomRuntime.atom(
    Effect.gen(function* () {
      const action = key.action;
      const stateRef = yield* Ref.make<BorrowExecutionMachineState>({
        action,
        currentTxIndex: 0,
        isDone: action.status === "SUCCESS",
        phase: action.status === "SUCCESS" ? "completed" : "signing",
        signedTransaction: null,
        step: null,
        submissions: [],
        transactions: action.transactions,
      });

      return processBorrowExecutionStep({
        intervalMs: key.confirmationPollIntervalMs ?? 2_000,
        stateRef,
        times: key.confirmationPollAttempts ?? 20,
      });
    })
  );

  return borrowAtomRuntime.atom((context) =>
    context.result(machineAtom).pipe(
      Effect.flatten,
      Stream.fromEffect,
      Stream.repeat(Schedule.forever),
      Stream.takeUntil((state) => state.isDone)
    )
  );
});

export const getBorrowExecutionResult = (
  state: BorrowExecutionMachineState
): BorrowExecutionResult => ({
  action: state.action,
  submissions: state.submissions,
});

export const getBorrowExecutionPhase = (
  state: BorrowExecutionMachineState | null
): BorrowExecutionPhase => state?.phase ?? "signing";

export const getBorrowExecutionSubmissions = (
  state: BorrowExecutionMachineState | null
): ReadonlyArray<BorrowSubmittedTransaction> => state?.submissions ?? [];

export const getBorrowExecutionAction = (
  state: BorrowExecutionMachineState | null
): Action | null => state?.action ?? null;

export const isBorrowExecutionDone = (
  state: BorrowExecutionMachineState | null
) => state?.isDone ?? false;
