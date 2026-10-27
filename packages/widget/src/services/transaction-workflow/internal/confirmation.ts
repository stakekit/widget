import { Data, Duration, Effect, Match, Ref, Schedule } from "effect";
import { isTransactionError } from "../../../domain/action/rules";
import {
  type Action as BorrowAction,
  isUnsuccessfulBorrowActionStatus,
} from "../../../domain/borrow/execution/action";
import { BorrowOperations, YieldOperations } from "../../api/operations";
import { EvmRpc } from "../../evm-rpc/evm-rpc";
import {
  type DirectTransactionLedger,
  TransactionConfirmationError,
  type TransactionWorkflowContext,
  type TransactionWorkflowInput,
} from "../transaction-workflow-model";
import { requireCurrentWorkflow } from "./current";
import { recordDirectTransaction } from "./ledger";
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
      readonly _tag: "Yield";
      readonly explorerUrl: string | null;
    }
  | {
      readonly _tag: "Borrow";
      readonly action: BorrowAction;
      readonly explorerUrl: null;
    };

export const makeConfirmCurrent = Effect.gen(function* () {
  const [borrowOperations, evmRpc, yieldOperations] = yield* Effect.all([
    BorrowOperations,
    EvmRpc,
    YieldOperations,
  ]);

  return Effect.fn("TransactionWorkflow.confirmCurrent")(function* ({
    context,
    input,
    latestContextRef,
    ledger,
  }: {
    readonly context: TransactionWorkflowContext;
    readonly input: TransactionWorkflowInput;
    readonly latestContextRef: Ref.Ref<TransactionWorkflowContext>;
    readonly ledger: DirectTransactionLedger;
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

    if (current._tag === "Direct") {
      const direct = current.transaction.source.transaction;
      const { chainId } = direct;
      const hash = current.transaction.meta.signedTx as `0x${string}` | null;
      if (!hash) return yield* fail("The transaction hash is not available.");
      const outcome = yield* evmRpc
        .awaitOutcome({ chainId, hash })
        .pipe(
          Effect.mapError((cause) =>
            fail("The transaction receipt could not be read.", cause)
          )
        );

      if (outcome !== "Confirmed") {
        // Nothing was spent, so Retry signs it again.
        yield* recordDirectTransaction(ledger, direct, null);
        yield* Ref.update(latestContextRef, (latest) =>
          updateCurrentTransactionWorkflowTransaction({
            context: latest,
            update: (current) => ({
              ...current,
              meta: {
                ...current.meta,
                broadcasted: null,
                signedTx: null,
                submissionIndex: null,
              },
            }),
          })
        );
        return yield* fail(
          outcome === "Reverted"
            ? "The transaction reverted."
            : "The transaction was dropped."
        );
      }

      yield* recordDirectTransaction(ledger, direct, {
        _tag: "Confirmed",
        hash,
      });
      return {
        context: selectNextTransactionWorkflowTransaction(
          updateCurrentTransactionWorkflowTransaction({
            context,
            update: (current) => ({
              ...current,
              meta: {
                ...current.meta,
                confirmationError: null,
                done: true,
                signError: null,
                url: evmRpc.explorerUrl({ chainId, hash }),
              },
            }),
          })
        ),
      };
    }

    const check = Match.value(current).pipe(
      Match.tag("Yield", ({ transaction }) => {
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
                      _tag: "Yield",
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

    const pollAttempts = input._tag === "Borrow" ? 20 : 75;
    const result = yield* check.pipe(
      Effect.retry({
        schedule: Schedule.spaced(
          Duration.max(
            Duration.zero,
            input._tag === "Borrow" ? Duration.seconds(2) : Duration.seconds(4)
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
