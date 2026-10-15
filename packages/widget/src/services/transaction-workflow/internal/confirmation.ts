import { Data, Duration, Effect, Match, Ref, Schedule } from "effect";
import { isTransactionError } from "../../../domain/action/rules";
import {
  type Action as BorrowAction,
  isUnsuccessfulBorrowActionStatus,
} from "../../../domain/borrow/execution/action";
import { BorrowOperations, YieldOperations } from "../../api/operations";
import {
  TransactionConfirmationError,
  type TransactionWorkflowContext,
  type TransactionWorkflowInput,
} from "../transaction-workflow-model";
import { requireCurrentWorkflow } from "./current";
import {
  isTransactionWorkflowDoneStatus,
  reconcileBorrowTransactionWorkflowBatch,
  selectNextTransactionWorkflowTransaction,
  updateCurrentTransactionWorkflowTransaction,
} from "./model";

class ConfirmationPendingError extends Data.TaggedError(
  "ConfirmationPendingError"
) {}

type ConfirmationCheckResult =
  | {
      readonly _tag: "Classic";
      readonly explorerUrl: string | null;
    }
  | {
      readonly _tag: "Borrow";
      readonly action: BorrowAction;
      readonly explorerUrl: null;
    };

export const makeConfirmCurrent = Effect.gen(function* () {
  const [borrowOperations, yieldOperations] = yield* Effect.all([
    BorrowOperations,
    YieldOperations,
  ]);

  return Effect.fn("TransactionWorkflow.confirmCurrent")(function* ({
    context,
    input,
    latestContextRef,
  }: {
    readonly context: TransactionWorkflowContext;
    readonly input: TransactionWorkflowInput;
    readonly latestContextRef: Ref.Ref<TransactionWorkflowContext>;
  }) {
    const current = yield* requireCurrentWorkflow(context);
    const { batch, transaction, workflowId } = current;
    const { source } = transaction;
    const fail = (message: string, cause?: unknown) =>
      new TransactionConfirmationError({
        batchId: batch.id,
        cause,
        message,
        network: source.transaction.network,
        transactionId: source.transaction.id,
        workflowId,
      });

    const check = Match.value(current).pipe(
      Match.tag("Classic", ({ transaction }) => {
        const { source } = transaction;

        return yieldOperations
          .getTransactionStatus({ transactionId: source.transaction.id })
          .pipe(
            Effect.mapError((cause) =>
              fail("Transaction status check failed.", cause)
            ),
            Effect.flatMap(
              (
                status
              ): Effect.Effect<
                ConfirmationCheckResult,
                ConfirmationPendingError | TransactionConfirmationError
              > => {
                if (isTransactionError(status.status)) {
                  return Effect.fail(
                    fail(`Transaction ended with ${status.status} status.`)
                  );
                }

                return isTransactionWorkflowDoneStatus(status.status)
                  ? Effect.succeed({
                      _tag: "Classic",
                      explorerUrl: status.explorerUrl ?? null,
                    })
                  : Effect.fail(new ConfirmationPendingError());
              }
            )
          );
      }),
      Match.tag("Borrow", ({ domain, transaction }) => {
        const { source } = transaction;

        return borrowOperations.getAction(domain.action.id).pipe(
          Effect.mapError((cause) =>
            fail("Borrow action status could not be checked.", cause)
          ),
          Effect.tap((action) =>
            action
              ? Ref.update(latestContextRef, (latest) =>
                  reconcileBorrowTransactionWorkflowBatch({
                    action,
                    context: latest,
                  })
                )
              : Effect.void
          ),
          Effect.flatMap(
            (
              action
            ): Effect.Effect<
              ConfirmationCheckResult,
              ConfirmationPendingError | TransactionConfirmationError
            > => {
              if (!action) {
                return Effect.fail(fail("Borrow action was not found."));
              }

              if (isUnsuccessfulBorrowActionStatus(action.status)) {
                return Effect.fail(
                  fail(`Borrow action ended with ${action.status} status.`)
                );
              }

              const updated = action.transactions.find(
                (candidate) => candidate.id === source.transaction.id
              );

              if (action.status === "SUCCESS") {
                return Effect.succeed({
                  _tag: "Borrow",
                  action,
                  explorerUrl: null,
                });
              }

              if (!updated) {
                return Effect.fail(
                  fail(
                    "Borrow transaction was not present in the action response."
                  )
                );
              }

              if (
                updated.status === "FAILED" ||
                updated.status === "NOT_FOUND"
              ) {
                return Effect.fail(
                  fail(
                    `Borrow transaction ended with ${updated.status} status.`
                  )
                );
              }

              return isTransactionWorkflowDoneStatus(updated.status)
                ? Effect.succeed({
                    _tag: "Borrow",
                    action,
                    explorerUrl: null,
                  })
                : Effect.fail(new ConfirmationPendingError());
            }
          )
        );
      }),
      Match.exhaustive
    );

    const pollAttempts = input._tag === "Classic" ? 75 : 20;
    const result = yield* check.pipe(
      Effect.retry({
        schedule: Schedule.spaced(
          Duration.max(
            Duration.zero,
            input._tag === "Classic" ? Duration.seconds(4) : Duration.seconds(2)
          )
        ),
        times: pollAttempts - 1,
        while: (error) => error._tag === "ConfirmationPendingError",
      }),
      Effect.mapError((error) =>
        error._tag === "ConfirmationPendingError"
          ? fail("Transaction confirmation polling was exhausted.")
          : error
      )
    );

    const reconciled =
      result._tag === "Borrow"
        ? reconcileBorrowTransactionWorkflowBatch({
            action: result.action,
            context,
          })
        : context;
    const confirmed = updateCurrentTransactionWorkflowTransaction({
      context: reconciled,
      update: (current) => ({
        ...current,
        meta: {
          ...current.meta,
          confirmationError: null,
          done: true,
          signError: null,
          url:
            result.explorerUrl ??
            (current.meta.submissionIndex === null
              ? current.meta.url
              : (context.submissions[current.meta.submissionIndex]?.link ??
                current.meta.url)),
        },
      }),
    });

    // A successful Borrow action is terminal: nothing in the batch is signed.
    return {
      context:
        result._tag === "Borrow" && result.action.status === "SUCCESS"
          ? { ...confirmed, currentTransactionIndex: null }
          : selectNextTransactionWorkflowTransaction(confirmed),
    };
  });
});
