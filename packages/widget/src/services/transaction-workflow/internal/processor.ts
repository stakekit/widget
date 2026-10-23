import { Effect, Match, Queue, Ref, SubscriptionRef } from "effect";
import {
  flattenTransactionWorkflowTransactions,
  getCurrentTransactionWorkflowBatch,
  getCurrentTransactionWorkflowTransaction,
  isFinalizePending,
  makeDirectTransactionLedger,
  type TransactionWorkflowAction,
  type TransactionWorkflowContext,
  type TransactionWorkflowInput,
  TransactionWorkflowInvariantError,
  type TransactionWorkflowState,
} from "../transaction-workflow-model";
import { makeAdvanceBatch } from "./advancement";
import { makeCheckApproval } from "./approval-check";
import { makeConfirmCurrent } from "./confirmation";
import type { HeldHashRegistration } from "./held-hash-registration";
import {
  getTransactionWorkflowAction,
  getTransactionWorkflowId,
  updateCurrentTransactionWorkflowTransaction,
} from "./model";
import { makePrepareAction } from "./preparation";
import { makePrepareAndSign, withSignedTransaction } from "./signing";
import { makeSubmitCurrent } from "./submission";

export const makeTransactionWorkflowProcessor = Effect.fn(
  "makeTransactionWorkflowProcessor"
)(function* (heldHashes: HeldHashRegistration) {
  const advanceBatch = yield* makeAdvanceBatch;
  const checkApproval = yield* makeCheckApproval;
  const confirmCurrent = yield* makeConfirmCurrent;
  const { finalizeUnwrap, prepareAction } = yield* makePrepareAction;
  const prepareAndSign = yield* makePrepareAndSign(heldHashes);
  const submitCurrent = yield* makeSubmitCurrent;

  return ({
    input,
    queue,
    resourcesChanged,
    stateRef,
  }: {
    readonly input: TransactionWorkflowInput;
    /** The failed states Retry was dispatched from, oldest first. */
    readonly queue: Queue.Queue<TransactionWorkflowState>;
    /** Announces that on-chain state owned by the workflow wallet changed. */
    readonly resourcesChanged: Effect.Effect<void>;
    readonly stateRef: SubscriptionRef.SubscriptionRef<TransactionWorkflowState>;
  }) => {
    // Only a confidential workflow holds Direct transactions.
    const ledger =
      input._tag === "Confidential"
        ? input.ledger
        : makeDirectTransactionLedger();
    const complete = (context: TransactionWorkflowContext) =>
      SubscriptionRef.set(stateRef, { _tag: "Completed", context });

    /**
     * A failed action still changed the wallet if any of its transactions
     * confirmed — locally, or in the latest Borrow action response when the
     * action failed before local confirmation caught up.
     */
    const settleFailed = (
      state: Extract<
        TransactionWorkflowState,
        { readonly _tag: "AdvanceFailed" | "ConfirmationFailed" }
      >
    ) =>
      SubscriptionRef.set(stateRef, state).pipe(
        Effect.andThen(
          flattenTransactionWorkflowTransactions(state.context).some(
            (transaction) => transaction.meta.done
          ) ||
            (state.context.domain._tag === "Borrow" &&
              state.context.domain.action.transactions.some(
                (transaction) => transaction.status === "CONFIRMED"
              ))
            ? resourcesChanged
            : Effect.void
        )
      );

    const runAdvance = (
      context: TransactionWorkflowContext,
      reconcile: boolean
    ): Effect.Effect<void> =>
      SubscriptionRef.set(stateRef, { _tag: "Advancing", context }).pipe(
        Effect.andThen(advanceBatch({ context, reconcile })),
        Effect.matchEffect({
          onFailure: (error) =>
            settleFailed({ _tag: "AdvanceFailed", context, error }),
          onSuccess: Match.valueTags({
            // An instant exit finalizes its confirmed unwrap before completing.
            Complete: (result) =>
              input._tag === "Confidential" &&
              input.finalizeUnwrap &&
              !result.context.finalize?.done
                ? resourcesChanged.pipe(
                    Effect.andThen(
                      runPreparation({
                        ...result.context,
                        finalize: {
                          done: false,
                          position: flattenTransactionWorkflowTransactions(
                            result.context
                          ).length,
                        },
                      })
                    )
                  )
                : complete(result.context).pipe(
                    Effect.andThen(resourcesChanged)
                  ),
            Continue: (result) => runCurrent(result.context),
          }),
        })
      );

    const runConfirmation = (
      context: TransactionWorkflowContext
    ): Effect.Effect<void> =>
      Effect.gen(function* () {
        const latestContextRef = yield* Ref.make(context);
        yield* SubscriptionRef.set(stateRef, { _tag: "Confirming", context });

        return yield* confirmCurrent({
          context,
          input,
          latestContextRef,
          ledger,
        }).pipe(
          Effect.matchEffect({
            onFailure: (error) =>
              Ref.get(latestContextRef).pipe(
                Effect.flatMap((latestContext) =>
                  settleFailed({
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
              resourcesChanged.pipe(
                Effect.andThen(
                  getCurrentTransactionWorkflowTransaction(confirmed)
                    ? runCurrent(confirmed)
                    : runAdvance(confirmed, false)
                )
              ),
          })
        );
      });

    const runSubmission = (
      context: TransactionWorkflowContext
    ): Effect.Effect<void> =>
      SubscriptionRef.set(stateRef, { _tag: "Submitting", context }).pipe(
        Effect.andThen(submitCurrent({ context, ledger })),
        Effect.matchEffect({
          onFailure: (error) =>
            SubscriptionRef.set(stateRef, {
              _tag: "SubmissionFailed",
              context,
              error,
            }),
          onSuccess: ({ context: submitted }) => runConfirmation(submitted),
        })
      );

    const runSigning = (
      context: TransactionWorkflowContext
    ): Effect.Effect<void> =>
      SubscriptionRef.set(stateRef, { _tag: "Signing", context }).pipe(
        Effect.andThen(checkApproval(context)),
        Effect.filterOrElse(
          (check) => check._tag === "Continue",
          () =>
            prepareAndSign({
              context,
              expectedOwner: input.walletScope,
              ledger,
              // The wallet's answer is the workflow's at once: a workflow
              // ending before Submitting still holds a broadcast hash to
              // register as a Held Hash.
              recordSigned: (signed) =>
                SubscriptionRef.update(stateRef, (state) => ({
                  ...state,
                  context: withSignedTransaction(state.context, signed),
                })),
            }).pipe(
              Effect.map((signed) => ({ _tag: "Signed", signed }) as const)
            )
        ),
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
          onSuccess: (result) => {
            // An approval that was skipped, or now resets first, moves on.
            if (result._tag === "Continue") return runCurrent(result.context);
            const { signed } = result;
            const current = getCurrentTransactionWorkflowTransaction(signed);
            const batch = getCurrentTransactionWorkflowBatch(signed);

            if (!current || !batch) {
              return Effect.die(
                new TransactionWorkflowInvariantError({
                  message: "Signing completed without a current transaction.",
                  workflowId: getTransactionWorkflowId(signed.domain),
                })
              );
            }

            return runSubmission(signed);
          },
        })
      );

    const runCurrent = (
      context: TransactionWorkflowContext
    ): Effect.Effect<void> => {
      const current = getCurrentTransactionWorkflowTransaction(context);

      if (!current) return runAdvance(context, false);

      return current.meta.broadcasted === true ||
        (current.source._tag === "Borrow" &&
          current.source.transaction.signablePayload == null)
        ? runConfirmation(context)
        : runSigning(context);
    };

    // A pending finalize prepares the unwrap's WITHDRAW; else the action.
    const runPreparation = (
      context: TransactionWorkflowContext
    ): Effect.Effect<void> => {
      if (input._tag !== "Confidential") {
        return Effect.die(
          new TransactionWorkflowInvariantError({
            message: "Only a confidential workflow prepares its action.",
            workflowId: getTransactionWorkflowId(context.domain),
          })
        );
      }
      const prepare =
        isFinalizePending(context) && input.finalizeUnwrap
          ? finalizeUnwrap({
              chainId: input.finalizeUnwrap.chainId,
              context,
              input,
            })
          : prepareAction({ context, input });
      return SubscriptionRef.set(stateRef, { _tag: "Preparing", context }).pipe(
        Effect.andThen(prepare),
        Effect.matchEffect({
          onFailure: (error) =>
            SubscriptionRef.set(stateRef, {
              _tag: "PrepareFailed",
              context,
              error,
            }),
          onSuccess: runCurrent,
        })
      );
    };

    const execute = (
      action: TransactionWorkflowAction,
      context: TransactionWorkflowContext
    ) => {
      switch (action) {
        case "prepare":
          return runPreparation(context);
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
          case "Preparing":
            return runPreparation(state.context);
          case "Signing":
            return runSigning(state.context);
          case "Confirming":
            return runConfirmation(state.context);
          case "Advancing":
            return runAdvance(state.context, false);
          case "Completed":
            return complete(state.context);
          case "Disabled":
          case "PrepareFailed":
          case "SignFailed":
          case "Submitting":
          case "SubmissionFailed":
          case "ConfirmationFailed":
          case "AdvanceFailed":
            return Effect.void;
        }
      })
    );

    // A Retry answers the failure it saw; a later failure needs its own.
    const commands = Queue.take(queue).pipe(
      Effect.flatMap((retried) =>
        SubscriptionRef.get(stateRef).pipe(
          Effect.flatMap((state) => {
            const action =
              state === retried
                ? getTransactionWorkflowAction({
                    command: { _tag: "Retry" },
                    state,
                  })
                : null;

            return action ? execute(action, state.context) : Effect.void;
          })
        )
      ),
      Effect.forever
    );

    return initial.pipe(Effect.andThen(commands));
  };
});
