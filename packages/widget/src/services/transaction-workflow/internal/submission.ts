import { Effect, Match } from "effect";
import { keccak256 } from "viem";
import { BorrowOperations, YieldOperations } from "../../api/operations";
import { EvmRpc } from "../../evm-rpc/evm-rpc";
import { TrackingService } from "../../tracking/tracking-service";
import {
  type DirectTransactionLedger,
  TransactionSubmissionError,
  type TransactionWorkflowContext,
  type TransactionWorkflowSubmission,
} from "../transaction-workflow-model";
import {
  getCurrentWorkflowTrackingYieldId,
  requireCurrentWorkflow,
} from "./current";
import { recordDirectTransaction } from "./ledger";
import { updateCurrentTransactionWorkflowTransaction } from "./model";

export const makeSubmitCurrent = Effect.gen(function* () {
  const [borrowOperations, evmRpc, tracking, yieldOperations] =
    yield* Effect.all([
      BorrowOperations,
      EvmRpc,
      TrackingService,
      YieldOperations,
    ]);

  return Effect.fn("TransactionWorkflow.submitCurrent")(function* ({
    context,
    ledger,
  }: {
    readonly context: TransactionWorkflowContext;
    readonly ledger: DirectTransactionLedger;
  }) {
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
      Match.tag("Direct", ({ transaction }) => {
        const { source } = transaction;
        const direct = source.transaction;
        const { chainId, id } = direct;
        const signed = signedTx as `0x${string}`;
        // The hash is known before the broadcast, so a lost response cannot
        // make Retry sign the transaction again.
        const hash = broadcasted ? signed : keccak256(signed);
        const broadcast = broadcasted
          ? Effect.void
          : Effect.uninterruptibleMask((restore) =>
              recordDirectTransaction(ledger, direct, {
                _tag: "Sent",
                hash,
              }).pipe(
                Effect.andThen(
                  restore(evmRpc.broadcast({ chainId, hash, signedTx: signed }))
                ),
                // Only a broadcast the node refused is forgotten: a failed or
                // interrupted one may still have reached it.
                Effect.tapError((error) =>
                  error._tag === "EvmBroadcastRejectedError"
                    ? recordDirectTransaction(ledger, direct, null)
                    : Effect.void
                )
              )
            );

        return broadcast.pipe(
          Effect.mapError((cause) =>
            fail("Transaction broadcast failed.", cause)
          ),
          Effect.as({
            batchId: batch.id,
            hash,
            link: evmRpc.explorerUrl({ chainId, hash }),
            signedPayload: broadcasted ? null : signed,
            source,
            status: null,
            transactionId: id,
          } satisfies TransactionWorkflowSubmission)
        );
      }),
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
          // A Direct transaction is confirmed by its hash.
          ...(current.source._tag === "Direct"
            ? { broadcasted: true, signedTx: submission.hash }
            : {}),
          confirmationError: null,
          signError: null,
          submissionIndex,
        },
      }),
    });

    yield* tracking.trackEvent("txSubmitted", {
      network: source.transaction.network,
      txId: source.transaction.id,
      yieldId: getCurrentWorkflowTrackingYieldId(current),
    });

    return { context: updated, submission };
  });
});
