import { Effect, Match, PubSub, Queue, Ref, SubscriptionRef } from "effect";
import {
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  getTransactionWorkflowAction,
  getTransactionWorkflowId,
  type TransactionWorkflowAction,
  type TransactionWorkflowContext,
  type TransactionWorkflowEvent,
  TransactionWorkflowInvariantError,
  type TransactionWorkflowKey,
  type TransactionWorkflowState,
  updateCurrentTransactionWorkflowTransaction,
} from "../transaction-workflow-model";
import type { TransactionWorkflowOperationsService } from "../transaction-workflow-operations-service";
import { advanceBatch } from "./advancement";
import { confirmCurrent } from "./confirmation";
import { prepareAndSign } from "./signing";
import { submitCurrent } from "./submission";

export const makeTransactionWorkflowProcessor = ({
  events,
  key,
  queue,
  stateRef,
}: {
  readonly events: PubSub.PubSub<TransactionWorkflowEvent>;
  readonly key: TransactionWorkflowKey;
  readonly queue: Queue.Queue<TransactionWorkflowAction>;
  readonly stateRef: SubscriptionRef.SubscriptionRef<TransactionWorkflowState>;
}) => {
  const complete = (context: TransactionWorkflowContext) =>
    SubscriptionRef.set(stateRef, { _tag: "Completed", context }).pipe(
      Effect.andThen(
        PubSub.publish(events, {
          _tag: "TransactionWorkflowCompleted",
          context,
        })
      ),
      Effect.asVoid
    );

  const runAdvance = (
    context: TransactionWorkflowContext,
    reconcile: boolean
  ) =>
    SubscriptionRef.set(stateRef, { _tag: "Advancing", context }).pipe(
      Effect.andThen(advanceBatch({ context, reconcile })),
      Effect.matchEffect({
        onFailure: (error) =>
          SubscriptionRef.set(stateRef, {
            _tag: "AdvanceFailed",
            context,
            error,
          }),
        onSuccess: Match.valueTags({
          Complete: (result) => complete(result.context),
          Continue: (result) =>
            PubSub.publish(events, {
              _tag: "TransactionWorkflowBatchAdvanced",
              batchId: result.batchId,
              context: result.context,
            }).pipe(
              Effect.andThen(() => runCurrent(result.context)),
              Effect.asVoid
            ),
        }),
      })
    );

  const runConfirmation = (
    context: TransactionWorkflowContext
  ): Effect.Effect<void, never, TransactionWorkflowOperationsService> =>
    Effect.gen(function* () {
      const latestContextRef = yield* Ref.make(context);
      yield* SubscriptionRef.set(stateRef, { _tag: "Confirming", context });

      return yield* confirmCurrent({
        context,
        key,
        latestContextRef,
      }).pipe(
        Effect.matchEffect({
          onFailure: (error) =>
            Ref.get(latestContextRef).pipe(
              Effect.flatMap((latestContext) =>
                SubscriptionRef.set(stateRef, {
                  _tag: "ConfirmationFailed",
                  context: updateCurrentTransactionWorkflowTransaction({
                    context: latestContext,
                    update: (current) => ({
                      ...current,
                      meta: { ...current.meta, confirmationError: error },
                    }),
                  }),
                  error,
                })
              )
            ),
          onSuccess: ({ context: confirmed }) =>
            getCurrentTransactionWorkflowTransaction(confirmed)
              ? runCurrent(confirmed)
              : runAdvance(confirmed, false),
        })
      );
    });

  const runSubmission = (
    context: TransactionWorkflowContext
  ): Effect.Effect<void, never, TransactionWorkflowOperationsService> =>
    SubscriptionRef.set(stateRef, { _tag: "Submitting", context }).pipe(
      Effect.andThen(submitCurrent(context)),
      Effect.matchEffect({
        onFailure: (error) =>
          SubscriptionRef.set(stateRef, {
            _tag: "SubmissionFailed",
            context,
            error,
          }),
        onSuccess: ({ context: submitted, submission }) =>
          PubSub.publish(events, {
            _tag: "TransactionWorkflowSubmitted",
            context: submitted,
            submission,
          }).pipe(Effect.andThen(runConfirmation(submitted)), Effect.asVoid),
      })
    );

  const runSigning = (
    context: TransactionWorkflowContext
  ): Effect.Effect<void, never, TransactionWorkflowOperationsService> =>
    SubscriptionRef.set(stateRef, { _tag: "Signing", context }).pipe(
      Effect.andThen(prepareAndSign(context)),
      Effect.matchEffect({
        onFailure: (error) =>
          SubscriptionRef.set(stateRef, {
            _tag: "SignFailed",
            context: updateCurrentTransactionWorkflowTransaction({
              context,
              update: (current) => ({
                ...current,
                meta: {
                  ...current.meta,
                  confirmationError: null,
                  signError: error,
                },
              }),
            }),
            error,
          }),
        onSuccess: (signed) => {
          const current = getCurrentTransactionWorkflowTransaction(signed);
          const batch = getCurrentTransactionWorkflowBatch(signed);

          if (!current || !batch) {
            return Effect.die(
              new TransactionWorkflowInvariantError({
                message: "Signing completed without a current transaction.",
                workflowId: getTransactionWorkflowId(key),
              })
            );
          }

          return PubSub.publish(events, {
            _tag: "TransactionWorkflowSigned",
            batchId: batch.id,
            source: current.source,
            transactionId: current.source.transaction.id,
            workflowId: getTransactionWorkflowId(key),
          }).pipe(Effect.andThen(runSubmission(signed)), Effect.asVoid);
        },
      })
    );

  const runCurrent = (
    context: TransactionWorkflowContext
  ): Effect.Effect<void, never, TransactionWorkflowOperationsService> => {
    const current = getCurrentTransactionWorkflowTransaction(context);

    if (!current) return runAdvance(context, false);

    return current.meta.broadcasted === true ||
      (current.source._tag === "Borrow" &&
        current.source.transaction.signablePayload == null)
      ? runConfirmation(context)
      : runSigning(context);
  };

  const execute = (
    action: TransactionWorkflowAction,
    context: TransactionWorkflowContext
  ) => {
    switch (action) {
      case "sign":
        return runSigning(context);
      case "submit":
        return runSubmission(context);
      case "confirm":
        return runConfirmation(context);
      case "advance":
        return runAdvance(context, true);
    }
  };

  const initial = SubscriptionRef.get(stateRef).pipe(
    Effect.flatMap((state) => {
      switch (state._tag) {
        case "Signing":
          return runSigning(state.context);
        case "Confirming":
          return runConfirmation(state.context);
        case "Advancing":
          return runAdvance(state.context, false);
        case "Completed":
          return complete(state.context);
        case "Disabled":
        case "SignFailed":
        case "Submitting":
        case "SubmissionFailed":
        case "ConfirmationFailed":
        case "AdvanceFailed":
          return Effect.void;
      }
    })
  );

  const commands = Queue.take(queue).pipe(
    Effect.flatMap((queuedAction) =>
      SubscriptionRef.get(stateRef).pipe(
        Effect.flatMap((state) => {
          const action = getTransactionWorkflowAction({
            command: { _tag: "Retry" },
            state,
          });

          return action === queuedAction
            ? execute(action, state.context)
            : Effect.void;
        })
      )
    ),
    Effect.forever
  );

  return initial.pipe(Effect.andThen(commands));
};
