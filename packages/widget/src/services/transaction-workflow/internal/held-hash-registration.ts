import { Duration, Effect, FiberMap, Match, Schedule } from "effect";
import {
  BorrowOperations,
  isTransientApiFailure,
  YieldOperations,
} from "../../api/operations";
import {
  getCurrentTransactionWorkflowTransaction,
  type TransactionWorkflowState,
} from "../transaction-workflow-model";

/** Retries after the first attempt: five attempts in all, 1s, 2s, 4s, 8s apart. */
const registrationRetries = 4;
const registrationBackoff = Duration.seconds(1);

/**
 * Registers broadcast hashes a closed workflow still held. A wallet that
 * broadcast a transaction returns its hash; until the API acknowledges it, the
 * transaction can land on-chain with no record. Leaving the Transaction Flow
 * must not drop that hash, so registration is owned by the service's Scope —
 * the Application Runtime Generation — rather than the workflow's.
 *
 * This is an engine policy keyed by the hash, not a transport retry: one hash
 * registers once at a time, a bounded number of attempts, and only while the
 * failure is transient. It neither navigates nor presents errors.
 */
export const makeHeldHashRegistration = Effect.gen(function* () {
  const [borrowOperations, yieldOperations] = yield* Effect.all([
    BorrowOperations,
    YieldOperations,
  ]);
  const registrations = yield* FiberMap.make<string>();

  return (state: TransactionWorkflowState): Effect.Effect<void> => {
    const transaction = getCurrentTransactionWorkflowTransaction(state.context);
    // A wallet-returned hash the API has not acknowledged for this transaction.
    const hash =
      transaction?.meta.broadcasted === true &&
      transaction.meta.submissionIndex === null
        ? transaction.meta.signedTx
        : null;
    // No API records a Direct transaction; its Ledger holds the hash.
    if (!transaction || !hash || transaction.source._tag === "Direct") {
      return Effect.void;
    }

    const register = Match.value(transaction.source).pipe(
      Match.tag("Classic", (source) =>
        yieldOperations.submitTransactionHashInBackground({
          payload: { hash },
          transactionId: source.transaction.id,
        })
      ),
      Match.tag("Borrow", (source) =>
        borrowOperations.submitTransactionInBackground({
          command: { transactionHash: hash },
          transactionId: source.transaction.id,
        })
      ),
      Match.exhaustive
    );
    const annotations = {
      event: "held_broadcast_hash_registration",
      hash,
      transactionId: transaction.source.transaction.id,
      workflowKind: transaction.source._tag,
    };

    return register.pipe(
      Effect.retry({
        schedule: Schedule.exponential(registrationBackoff),
        times: registrationRetries,
        while: isTransientApiFailure,
      }),
      Effect.matchEffect({
        onFailure: (cause) =>
          Effect.logWarning("Held broadcast hash was not registered").pipe(
            Effect.annotateLogs({ ...annotations, cause })
          ),
        onSuccess: () =>
          Effect.logInfo("Held broadcast hash registered").pipe(
            Effect.annotateLogs(annotations)
          ),
      }),
      FiberMap.run(registrations, hash, { onlyIfMissing: true }),
      // A runtime that already ended has nothing left to own the registration.
      Effect.exit,
      Effect.asVoid
    );
  };
});
