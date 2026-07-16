import { Effect, Match } from "effect";
import {
  TransactionSubmissionError,
  type TransactionWorkflowContext,
  type TransactionWorkflowSubmission,
  updateCurrentTransactionWorkflowTransaction,
} from "../transaction-workflow-model";
import { TransactionWorkflowOperationsService } from "../transaction-workflow-operations-service";
import { requireCurrentWorkflow } from "./current";

export const submitCurrent = Effect.fn("TransactionWorkflow.submitCurrent")(
  function* (context: TransactionWorkflowContext) {
    const operations = yield* TransactionWorkflowOperationsService;
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
          ? operations.submitClassicHash({
              payload: { hash: signedTx },
              transactionId: source.transaction.id,
            })
          : operations.submitClassicSigned({
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
          Effect.as({
            batchId: batch.id,
            hash: broadcasted ? signedTx : null,
            link: null,
            signedPayload: broadcasted ? null : signedTx,
            source,
            status: null,
            transactionId: source.transaction.id,
          } satisfies TransactionWorkflowSubmission)
        );
      }),
      Match.tag("Borrow", ({ transaction }) => {
        const { source } = transaction;

        return operations
          .submitBorrowTransaction({
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

    yield* operations.trackEvent("txSubmitted", {
      network: source.transaction.network,
      txId: source.transaction.id,
      yieldId,
    });

    return { context: updated, submission };
  }
);
