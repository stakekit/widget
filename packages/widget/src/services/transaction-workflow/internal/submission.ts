import { Effect, Match } from "effect";
import { type Hex, isHex, keccak256 } from "viem";
import {
  type SignedTransactionPayload,
  TransactionHash,
  type WalletSignature,
} from "../../../domain/identity/identifiers";
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

type TransactionWorkflowTransactionMeta =
  TransactionWorkflowContext["batches"][number]["transactions"][number]["meta"];

/** What the wallet returned that a submission records. */
type SubmittableSigned =
  | { readonly broadcasted: true; readonly signedTx: TransactionHash }
  | {
      readonly broadcasted: false;
      readonly signedTx: SignedTransactionPayload | WalletSignature;
    };

/** Null until the wallet returned something, or when no hash is known. */
const getSubmittableSigned = (
  meta: TransactionWorkflowTransactionMeta
): SubmittableSigned | null => {
  if (meta.broadcasted === null) return null;
  if (meta.broadcasted === false) return meta;
  return meta.signedTx === null
    ? null
    : { broadcasted: true, signedTx: meta.signedTx };
};

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
    const signed = getSubmittableSigned(transaction.meta);
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

    if (!signed) {
      return yield* fail("The signed transaction payload is not available.");
    }

    const submission = yield* Match.value(current).pipe(
      Match.tag("Direct", ({ transaction }) => {
        const { source } = transaction;
        const direct = source.transaction;
        const { chainId, id } = direct;
        const submitted = (
          hash: TransactionHash,
          evmHash: Hex,
          signedPayload: SignedTransactionPayload | WalletSignature | null
        ) =>
          ({
            batchId: batch.id,
            hash,
            link: evmRpc.explorerUrl({ chainId, hash: evmHash }),
            signedPayload,
            source,
            status: null,
            transactionId: id,
          }) satisfies TransactionWorkflowSubmission;

        // viem takes hex, and an EVM wallet answers in it.
        if (signed.broadcasted) {
          const hash = signed.signedTx;
          return isHex(hash)
            ? Effect.succeed(submitted(hash, hash, null))
            : Effect.fail(fail("The transaction hash is not EVM hex."));
        }

        const payload = signed.signedTx;
        if (!isHex(payload)) {
          return Effect.fail(fail("The signed transaction is not EVM hex."));
        }
        // The hash is known before the broadcast, so a lost response cannot
        // make Retry sign the transaction again.
        const evmHash = keccak256(payload);
        const hash = TransactionHash.make(evmHash);

        return Effect.uninterruptibleMask((restore) =>
          recordDirectTransaction(ledger, direct, {
            _tag: "Sent",
            hash,
          }).pipe(
            Effect.andThen(
              restore(
                evmRpc.broadcast({ chainId, hash: evmHash, signedTx: payload })
              )
            ),
            // Only a broadcast the node refused is forgotten: a failed or
            // interrupted one may still have reached it.
            Effect.tapError((error) =>
              error._tag === "EvmBroadcastRejectedError"
                ? recordDirectTransaction(ledger, direct, null)
                : Effect.void
            )
          )
        ).pipe(
          Effect.mapError((cause) =>
            fail("Transaction broadcast failed.", cause)
          ),
          Effect.as(submitted(hash, evmHash, payload))
        );
      }),
      Match.tag("Yield", ({ transaction }) => {
        const { source } = transaction;
        const submit = signed.broadcasted
          ? yieldOperations.submitTransactionHash({
              payload: { hash: signed.signedTx },
              transactionId: source.transaction.id,
            })
          : yieldOperations.submitSignedTransaction({
              payload: { signedTransaction: signed.signedTx },
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
                hash: signed.broadcasted
                  ? signed.signedTx
                  : (response.hash ?? null),
                link: response.explorerUrl ?? null,
                signedPayload: signed.broadcasted ? null : signed.signedTx,
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
            command: signed.broadcasted
              ? { transactionHash: signed.signedTx }
              : { signedPayload: signed.signedTx },
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
                  hash: signed.broadcasted
                    ? signed.signedTx
                    : (response.transactionHash ?? null),
                  link: response.link ?? null,
                  signedPayload: signed.broadcasted ? null : signed.signedTx,
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
      update: (current) => {
        const meta = {
          ...current.meta,
          confirmationError: null,
          signError: null,
          submissionIndex,
        };
        return {
          ...current,
          // A Direct transaction is confirmed by its hash.
          meta:
            current.source._tag === "Direct"
              ? { ...meta, broadcasted: true, signedTx: submission.hash }
              : meta,
        };
      },
    });

    yield* tracking.trackEvent("txSubmitted", {
      network: source.transaction.network,
      txId: source.transaction.id,
      yieldId: getCurrentWorkflowTrackingYieldId(current),
    });

    return { context: updated, submission };
  });
});
