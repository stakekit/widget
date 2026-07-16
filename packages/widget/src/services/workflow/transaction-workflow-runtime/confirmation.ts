import { Data, Duration, Effect, Match, pipe, Ref, Schedule } from "effect";
import { isTxError } from "../../../domain";
import type {
  Action as BorrowAction,
  Transaction as BorrowTransaction,
} from "../../../domain/borrow";
import type { ActionTransaction } from "../../../domain/schema/action-models";
import {
  isTerminalBorrowActionStatus,
  selectNextTransactionWorkflowTransaction,
  TransactionConfirmationError,
  type TransactionWorkflowContext,
  type TransactionWorkflowKey,
  updateCurrentTransactionWorkflowTransaction,
} from "../transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../transaction-workflow-operations-service";
import { requireCurrentWorkflow } from "./current";

class ConfirmationPendingError extends Data.TaggedError(
  "ConfirmationPendingError"
) {}

type ConfirmationCheckResult =
  | {
      readonly _tag: "Classic";
      readonly explorerUrl: string | null;
      readonly transaction: ActionTransaction;
    }
  | {
      readonly _tag: "Borrow";
      readonly action: BorrowAction;
      readonly explorerUrl: null;
      readonly transaction: BorrowTransaction;
    };

export const confirmCurrent = Effect.fn("TransactionWorkflow.confirmCurrent")(
  function* ({
    context,
    key,
    latestContextRef,
  }: {
    readonly context: TransactionWorkflowContext;
    readonly key: TransactionWorkflowKey;
    readonly latestContextRef: Ref.Ref<TransactionWorkflowContext>;
  }) {
    const operations = yield* TransactionWorkflowOperationsService;
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

        return operations
          .getClassicStatus({ transactionId: source.transaction.id })
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
                if (isTxError(status.status)) {
                  return Effect.fail(
                    fail(`Transaction ended with ${status.status} status.`)
                  );
                }

                return status.status === "CONFIRMED"
                  ? Effect.succeed({
                      _tag: "Classic",
                      explorerUrl: status.explorerUrl ?? null,
                      transaction: source.transaction,
                    })
                  : Effect.fail(new ConfirmationPendingError());
              }
            )
          );
      }),
      Match.tag("Borrow", ({ domain, transaction }) => {
        const { source } = transaction;

        return operations.getBorrowAction(domain.action.id).pipe(
          Effect.mapError((cause) =>
            fail("Borrow action status could not be checked.", cause)
          ),
          Effect.tap((action) =>
            action
              ? Ref.update(latestContextRef, (latest) => ({
                  ...latest,
                  domain: { _tag: "Borrow" as const, action },
                }))
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

              if (isTerminalBorrowActionStatus(action.status)) {
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
                  transaction: updated ?? source.transaction,
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

              return updated.status === "CONFIRMED" ||
                updated.status === "SKIPPED"
                ? Effect.succeed({
                    _tag: "Borrow",
                    action,
                    explorerUrl: null,
                    transaction: updated,
                  })
                : Effect.fail(new ConfirmationPendingError());
            }
          )
        );
      }),
      Match.exhaustive
    );

    const pollAttempts = key._tag === "Classic" ? 75 : 20;
    const result = yield* check.pipe(
      Effect.retry({
        schedule: Schedule.spaced(
          Duration.max(
            Duration.zero,
            key._tag === "Classic" ? Duration.seconds(4) : Duration.seconds(2)
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

    const updated = pipe(
      updateCurrentTransactionWorkflowTransaction({
        context:
          result._tag === "Borrow"
            ? { ...context, domain: { _tag: "Borrow", action: result.action } }
            : context,
        update: (current) => ({
          ...current,
          source:
            current.source._tag === "Borrow" && result._tag === "Borrow"
              ? { _tag: "Borrow", transaction: result.transaction }
              : current.source,
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
      }),
      selectNextTransactionWorkflowTransaction
    );

    return { context: updated };
  }
);
