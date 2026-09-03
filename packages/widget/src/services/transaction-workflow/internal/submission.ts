import { Effect, Match } from "effect";
import { BorrowOperations, YieldOperations } from "../../api/operations";
import { TrackingService } from "../../tracking/tracking-service";
import {
  TransactionSubmissionError,
  type TransactionWorkflowContext,
  type TransactionWorkflowSubmission,
} from "../transaction-workflow-model";
import { requireCurrentWorkflow } from "./current";
import { updateCurrentTransactionWorkflowTransaction } from "./model";

export const makeSubmitCurrent = Effect.gen(function* () {
  const [borrowOperations, tracking, yieldOperations] = yield* Effect.all([
    BorrowOperations,
    TrackingService,
    YieldOperations,
  ]);

  return Effect.fn("TransactionWorkflow.submitCurrent")(function* (
    context: TransactionWorkflowContext
  ) {
    const current = yield* requireCurrentWorkflow(context);
    const { batch, transaction, workflowId } = current;
    const { source } = transaction;
    const signedTx = transaction.meta.signedTx;
    const broadcasted = transaction.meta.broadcasted === true;
    const fail = (message: string, cause?: unknown) =>
      new TransactionSubmissionError({
        batchId: batch.id,
        broadcasted,
        cause,
        message,
        transactionId: source.transaction.id,
        workflowId,
      });

    if (!signedTx) {
      return yield* fail("The signed transaction payload is not available.");
    }

    const submission = yield* Match.value(current).pipe(
      Match.tag("Classic", ({ transaction }) => {
        const { source } = transaction;
        const submit = broadcasted
          ? yieldOperations.submitTransactionHash({
              payload: { hash: signedTx },
              transactionId: source.transaction.id,
            })
          : yieldOperations.submitSignedTransaction({
              payload: { signedTransaction: signedTx },
              transactionId: source.transaction.id,
            });

        return submit.pipe(
          Effect.mapError((cause) =>
            fail(
              broadcasted
                ? "Transaction hash submission failed."
                : "Signed transaction submission failed.",
              cause
            )
          ),
          Effect.map(
            (response) =>
              ({
                batchId: batch.id,
                hash: broadcasted ? signedTx : (response.hash ?? null),
                link: response.explorerUrl ?? null,
                signedPayload: broadcasted ? null : signedTx,
                source,
                status: response.status ?? null,
                transactionId: source.transaction.id,
              }) satisfies TransactionWorkflowSubmission
          )
        );
      }),
      Match.tag("Borrow", ({ transaction }) => {
        const { source } = transaction;

        return borrowOperations
          .submitTransaction({
            command: broadcasted
              ? { transactionHash: signedTx }
              : { signedPayload: signedTx },
            transactionId: source.transaction.id,
          })
          .pipe(
            Effect.mapError((cause) =>
              fail("Borrow transaction could not be submitted.", cause)
            ),
            Effect.map(
              (response) =>
                ({
                  batchId: batch.id,
                  hash: broadcasted
                    ? signedTx
                    : (response.transactionHash ?? signedTx),
                  link: response.link ?? null,
                  signedPayload: broadcasted ? null : signedTx,
                  source,
                  status: response.status ?? null,
                  transactionId: source.transaction.id,
                }) satisfies TransactionWorkflowSubmission
            )
          );
      }),
      Match.exhaustive
    );

    const submissionIndex = context.submissions.length;
    const updated = updateCurrentTransactionWorkflowTransaction({
      context: {
        ...context,
        submissions: [...context.submissions, submission],
      },
      update: (current) => ({
        ...current,
        meta: {
          ...current.meta,
          confirmationError: null,
          signError: null,
          submissionIndex,
        },
      }),
    });
    const yieldId = Match.value(current).pipe(
      Match.tag("Classic", ({ domain }) => domain.yieldId),
      Match.tag("Borrow", ({ domain }) => domain.action.integrationId),
      Match.exhaustive
    );

    yield* tracking.trackEvent("txSubmitted", {
      network: source.transaction.network,
      txId: source.transaction.id,
      yieldId,
    });

    return { context: updated, submission };
  });
});
