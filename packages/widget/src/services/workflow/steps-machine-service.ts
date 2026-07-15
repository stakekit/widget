import {
  Context,
  Data,
  Duration,
  Effect,
  Layer,
  PubSub,
  Queue,
  Schedule,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect";
import { isTxError } from "../../domain";
import type {
  ActionTransaction,
  SubmitSignedTransactionCommand,
  SubmitTransactionHashCommand,
  TransactionStatusCommand,
} from "../../domain/schema/action-models";
import type { Network } from "../../domain/schema/network-model";

import type { SKTxMeta } from "../../public-api/types";
import { YieldApiService } from "../api/yield-api-service";
import { TrackingService } from "../tracking/tracking-service";
import { WalletService } from "../wallet/wallet-service";
import {
  getCurrentStepsTransaction,
  getStepsMachineAction,
  initializeStepsMachine,
  StepsConfirmationError,
  type StepsMachineAction,
  type StepsMachineCommand,
  type StepsMachineContext,
  StepsMachineInvariantError,
  type StepsMachineKey,
  type StepsMachineState,
  StepsSignError,
  StepsSubmissionError,
  updateCurrentStepsTransaction,
} from "./steps-machine-model";

type StepsSignTransactionRequest = {
  readonly ledgerHwAppId: null;
  readonly network: Network;
  readonly tx: string;
  readonly txMeta: SKTxMeta;
};

type StepsTransactionStatus = Pick<ActionTransaction, "explorerUrl" | "status">;

class StepsConfirmationPendingError extends Data.TaggedError(
  "StepsConfirmationPendingError"
) {}

const makeStepsMachineOperations = Effect.gen(function* () {
  const [api, tracking, wallet] = yield* Effect.all([
    YieldApiService,
    TrackingService,
    WalletService,
  ]);

  return {
    getStatus: (
      command: TransactionStatusCommand
    ): Effect.Effect<StepsTransactionStatus, unknown> =>
      api
        .getTransactionStatus(command)
        .pipe(
          Effect.map(({ explorerUrl, status }) => ({ explorerUrl, status }))
        ),
    signMessage: (message: string) => wallet.signMessage({ message }),
    signTransaction: (request: StepsSignTransactionRequest) =>
      wallet.signTransaction(request),
    submitHash: (
      command: SubmitTransactionHashCommand
    ): Effect.Effect<void, unknown> =>
      api.submitTransactionHash(command).pipe(Effect.asVoid),
    submitSigned: (
      command: SubmitSignedTransactionCommand
    ): Effect.Effect<void, unknown> =>
      api.submitSignedTransaction(command).pipe(Effect.asVoid),
    trackEvent: tracking.trackEvent,
  };
});

export type StepsMachineOperations = Effect.Success<
  typeof makeStepsMachineOperations
>;

type StepsMachineEvent =
  | {
      readonly _tag: "StepsSignSucceeded";
      readonly transactionId: string;
    }
  | {
      readonly _tag: "StepsCompleted";
      readonly context: StepsMachineContext;
    };

export type StepsMachineHandle = {
  readonly dispatch: (command: StepsMachineCommand) => Effect.Effect<void>;
  readonly events: Stream.Stream<StepsMachineEvent>;
  readonly states: Stream.Stream<StepsMachineState>;
};

type WalletTransactionError = Effect.Error<
  ReturnType<WalletService["Service"]["signTransaction"]>
>;

const getTransactionCustomMessage = (
  error: WalletTransactionError
): string | null =>
  error._tag === "WalletBroadcastError" ? error.customMessage : null;

const requireCurrentTransaction = (context: StepsMachineContext) => {
  const current = getCurrentStepsTransaction(context);

  return current
    ? Effect.succeed(current)
    : Effect.die(
        new StepsMachineInvariantError({
          message: "The steps machine has no current transaction.",
        })
      );
};

const toUnsignedPayload = (transaction: ActionTransaction) => {
  if (transaction.unsignedTransaction == null) {
    return Effect.fail(
      new StepsSignError({
        customMessage: null,
        message: "The transaction has no unsigned payload.",
        network: transaction.network,
        transactionId: transaction.id,
      })
    );
  }

  return Effect.succeed(
    typeof transaction.unsignedTransaction === "string"
      ? transaction.unsignedTransaction
      : JSON.stringify(transaction.unsignedTransaction)
  );
};

const signCurrentStepsTransaction = Effect.fn("signCurrentStepsTransaction")(
  function* ({
    context,
    key,
    operations,
  }: {
    readonly context: StepsMachineContext;
    readonly key: StepsMachineKey;
    readonly operations: StepsMachineOperations;
  }): Effect.fn.Return<StepsMachineContext, StepsSignError> {
    const current = yield* requireCurrentTransaction(context);

    if (
      current.tx.status === "BROADCASTED" ||
      current.tx.status === "CONFIRMED"
    ) {
      return context;
    }

    const payload = yield* toUnsignedPayload(current.tx);
    const signed = current.tx.isMessage
      ? yield* operations.signMessage(payload).pipe(
          Effect.map((signedTx) => ({ broadcasted: false, signedTx })),
          Effect.mapError(
            (cause) =>
              new StepsSignError({
                cause,
                customMessage: null,
                message: "Message signing failed.",
                network: current.tx.network,
                transactionId: current.tx.id,
              })
          )
        )
      : yield* operations
          .signTransaction({
            ledgerHwAppId: null,
            network: current.tx.network as Network,
            tx: payload,
            txMeta: {
              ...key.actionMeta,
              annotatedTransaction: current.tx.annotatedTransaction,
              gasEstimate: current.tx.gasEstimate,
              structuredTransaction: current.tx.structuredTransaction,
              txId: current.tx.id,
              txType: current.tx.type,
            },
          })
          .pipe(
            Effect.mapError(
              (cause) =>
                new StepsSignError({
                  cause,
                  customMessage: getTransactionCustomMessage(cause),
                  message: "Transaction signing failed.",
                  network: current.tx.network,
                  transactionId: current.tx.id,
                })
            )
          );

    yield* operations.trackEvent("txSigned", {
      network: current.tx.network,
      txId: current.tx.id,
      yieldId: context.yieldId,
    });

    return updateCurrentStepsTransaction({
      context,
      update: (transaction) => ({
        ...transaction,
        meta: {
          ...transaction.meta,
          broadcasted: signed.broadcasted,
          signError: null,
          signedTx: signed.signedTx,
          txCheckError: null,
        },
      }),
    });
  }
);

const submitCurrentStepsTransaction = Effect.fn(
  "submitCurrentStepsTransaction"
)(function* ({
  context,
  operations,
}: {
  readonly context: StepsMachineContext;
  readonly operations: StepsMachineOperations;
}): Effect.fn.Return<StepsMachineContext, StepsSubmissionError> {
  const current = yield* requireCurrentTransaction(context);
  const signedTx = current.meta.signedTx;

  if (!signedTx) {
    return yield* new StepsSubmissionError({
      broadcasted: current.meta.broadcasted === true,
      message: "The signed transaction payload is not available.",
      transactionId: current.tx.id,
    });
  }

  const submit = current.meta.broadcasted
    ? operations.submitHash({
        payload: { hash: signedTx },
        transactionId: current.tx.id,
      })
    : operations.submitSigned({
        payload: { signedTransaction: signedTx },
        transactionId: current.tx.id,
      });

  yield* submit.pipe(
    Effect.mapError(
      (cause) =>
        new StepsSubmissionError({
          broadcasted: current.meta.broadcasted === true,
          cause,
          message: current.meta.broadcasted
            ? "Transaction hash submission failed."
            : "Signed transaction submission failed.",
          transactionId: current.tx.id,
        })
    )
  );
  yield* operations.trackEvent("txSubmitted", {
    network: current.tx.network,
    txId: current.tx.id,
    yieldId: context.yieldId,
  });

  return updateCurrentStepsTransaction({
    context,
    update: (transaction) => ({
      ...transaction,
      meta: {
        ...transaction.meta,
        signError: null,
        txCheckError: null,
      },
    }),
  });
});

type ConfirmationResult = {
  readonly context: StepsMachineContext;
  readonly isComplete: boolean;
};

const confirmCurrentStepsTransaction = Effect.fn(
  "confirmCurrentStepsTransaction"
)(function* ({
  context,
  operations,
  pollAttempts,
  pollInterval,
}: {
  readonly context: StepsMachineContext;
  readonly operations: StepsMachineOperations;
  readonly pollAttempts: number;
  readonly pollInterval: Duration.Duration;
}): Effect.fn.Return<ConfirmationResult, StepsConfirmationError> {
  const current = yield* requireCurrentTransaction(context);
  const attempts = Math.max(1, pollAttempts);

  const checkStatus: Effect.Effect<
    StepsTransactionStatus,
    StepsConfirmationError | StepsConfirmationPendingError
  > = Effect.gen(function* () {
    const status = yield* operations
      .getStatus({ transactionId: current.tx.id })
      .pipe(
        Effect.mapError(
          (cause) =>
            new StepsConfirmationError({
              cause,
              message: "Transaction status check failed.",
              network: current.tx.network,
              transactionId: current.tx.id,
            })
        )
      );

    if (isTxError(status.status)) {
      yield* operations.trackEvent("txNotConfirmed", {
        txId: current.tx.id,
        yieldId: context.yieldId,
      });
      return yield* new StepsConfirmationError({
        message: `Transaction ended with ${status.status} status.`,
        network: current.tx.network,
        transactionId: current.tx.id,
      });
    }

    if (status.status === "CONFIRMED") {
      return status;
    }

    return yield* new StepsConfirmationPendingError();
  });

  const status = yield* checkStatus.pipe(
    Effect.retry({
      schedule: Schedule.spaced(Duration.max(Duration.zero, pollInterval)),
      times: attempts - 1,
      while: (error: StepsConfirmationError | StepsConfirmationPendingError) =>
        error._tag === "StepsConfirmationPendingError",
    }),
    Effect.mapError(
      (error: StepsConfirmationError | StepsConfirmationPendingError) =>
        error._tag === "StepsConfirmationPendingError"
          ? new StepsConfirmationError({
              message: "Transaction confirmation polling was exhausted.",
              network: current.tx.network,
              transactionId: current.tx.id,
            })
          : error
    )
  );
  const confirmedContext = updateCurrentStepsTransaction({
    context,
    update: (transaction) => ({
      ...transaction,
      meta: {
        ...transaction.meta,
        done: true,
        signError: null,
        txCheckError: null,
        url: status.explorerUrl ?? null,
      },
    }),
  });
  const nextIndex = confirmedContext.txStates.findIndex(
    (transaction) => !transaction.meta.done
  );

  return {
    context: {
      ...confirmedContext,
      currentTxIndex: nextIndex === -1 ? null : nextIndex,
    },
    isComplete: nextIndex === -1,
  };
});

const makeProcessor = ({
  events,
  key,
  operations,
  queue,
  stateRef,
}: {
  readonly events: PubSub.PubSub<StepsMachineEvent>;
  readonly key: StepsMachineKey;
  readonly operations: StepsMachineOperations;
  readonly queue: Queue.Queue<StepsMachineCommand>;
  readonly stateRef: SubscriptionRef.SubscriptionRef<StepsMachineState>;
}) => {
  const completeConfirmation = (
    context: StepsMachineContext
  ): Effect.Effect<void> =>
    confirmCurrentStepsTransaction({
      context,
      operations,
      pollAttempts: key.confirmationPollAttempts ?? 75,
      pollInterval: key.confirmationPollInterval ?? Duration.seconds(4),
    }).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          SubscriptionRef.set(stateRef, {
            _tag: "ConfirmationFailed",
            context: updateCurrentStepsTransaction({
              context,
              update: (transaction) => ({
                ...transaction,
                meta: {
                  ...transaction.meta,
                  signError: null,
                  txCheckError: error,
                },
              }),
            }),
            error,
          }),
        onSuccess: (result) => {
          if (result.isComplete) {
            return SubscriptionRef.set(stateRef, {
              _tag: "Completed",
              context: result.context,
            }).pipe(
              Effect.andThen(
                PubSub.publish(events, {
                  _tag: "StepsCompleted",
                  context: result.context,
                })
              ),
              Effect.asVoid
            );
          }

          return completeSigning(result.context);
        },
      })
    );

  const completeSubmission = (
    context: StepsMachineContext
  ): Effect.Effect<void> =>
    SubscriptionRef.set(stateRef, { _tag: "Submitting", context }).pipe(
      Effect.andThen(submitCurrentStepsTransaction({ context, operations })),
      Effect.matchEffect({
        onFailure: (error) =>
          SubscriptionRef.set(stateRef, {
            _tag: "SubmissionFailed",
            context,
            error,
          }),
        onSuccess: (submittedContext) =>
          SubscriptionRef.set(stateRef, {
            _tag: "Confirming",
            context: submittedContext,
          }).pipe(Effect.andThen(completeConfirmation(submittedContext))),
      })
    );

  const completeSigning = (context: StepsMachineContext): Effect.Effect<void> =>
    SubscriptionRef.set(stateRef, { _tag: "Signing", context }).pipe(
      Effect.andThen(signCurrentStepsTransaction({ context, key, operations })),
      Effect.matchEffect({
        onFailure: (error) =>
          SubscriptionRef.set(stateRef, {
            _tag: "SignFailed",
            context: updateCurrentStepsTransaction({
              context,
              update: (transaction) => ({
                ...transaction,
                meta: {
                  ...transaction.meta,
                  signError: error,
                  txCheckError: null,
                },
              }),
            }),
            error,
          }),
        onSuccess: (signedContext) => {
          const current = getCurrentStepsTransaction(signedContext);

          if (!current) {
            return Effect.die(
              new StepsMachineInvariantError({
                message: "Signing completed without a current transaction.",
              })
            );
          }

          if (current.tx.status === "BROADCASTED") {
            return SubscriptionRef.set(stateRef, {
              _tag: "Confirming",
              context: signedContext,
            }).pipe(Effect.andThen(completeConfirmation(signedContext)));
          }

          return PubSub.publish(events, {
            _tag: "StepsSignSucceeded",
            transactionId: current.tx.id,
          }).pipe(
            Effect.andThen(completeSubmission(signedContext)),
            Effect.asVoid
          );
        },
      })
    );

  const execute = (
    action: StepsMachineAction,
    context: StepsMachineContext
  ) => {
    switch (action) {
      case "sign":
        return completeSigning(context);
      case "submit":
        return completeSubmission(context);
      case "confirm":
        return SubscriptionRef.set(stateRef, {
          _tag: "Confirming",
          context,
        }).pipe(Effect.andThen(completeConfirmation(context)));
    }
  };

  return Queue.take(queue).pipe(
    Effect.flatMap((command) =>
      SubscriptionRef.get(stateRef).pipe(
        Effect.flatMap((state) => {
          const action = getStepsMachineAction({ command, state });

          return action ? execute(action, state.context) : Effect.void;
        })
      )
    ),
    Effect.forever
  );
};

export const makeStepsMachine = Effect.fn("makeStepsMachine")(function* ({
  key,
  operations,
}: {
  readonly key: StepsMachineKey;
  readonly operations: StepsMachineOperations;
}): Effect.fn.Return<StepsMachineHandle, never, Scope.Scope> {
  const queue = yield* Queue.bounded<StepsMachineCommand>(16);
  const stateRef = yield* SubscriptionRef.make(
    initializeStepsMachine({
      transactions: key.transactions,
      yieldId: key.yieldId,
    })
  );
  const events = yield* PubSub.sliding<StepsMachineEvent>({
    capacity: 32,
    replay: 8,
  });

  yield* Effect.addFinalizer(() =>
    Effect.all([Queue.shutdown(queue), PubSub.shutdown(events)], {
      concurrency: "unbounded",
      discard: true,
    })
  );
  yield* makeProcessor({ events, key, operations, queue, stateRef }).pipe(
    Effect.forkScoped
  );

  return {
    dispatch: (command) => Queue.offer(queue, command).pipe(Effect.asVoid),
    events: Stream.fromPubSub(events),
    states: SubscriptionRef.changes(stateRef),
  };
});

export class StepsMachineService extends Context.Service<StepsMachineService>()(
  "stakekit/widget/steps/StepsMachineService",
  {
    make: Effect.map(makeStepsMachineOperations, (operations) => ({
      make: (key: StepsMachineKey) => makeStepsMachine({ key, operations }),
    })),
  }
) {
  static readonly layer = Layer.effect(
    StepsMachineService,
    StepsMachineService.make
  );
}
