import {
  Duration,
  Effect,
  Exit,
  Fiber,
  FiberMap,
  FiberSet,
  Match,
  Schedule,
} from "effect";
import type { TransactionHash } from "../../../domain/identity/identifiers";
import {
  BorrowOperations,
  isTransientApiFailure,
  YieldOperations,
} from "../../api/operations";
import type {
  WalletBroadcastResult,
  WalletSignedPayloadResult,
} from "../../wallet/wallet-transactions";
import {
  getCurrentTransactionWorkflowTransaction,
  type TransactionWorkflowState,
  type TransactionWorkflowTransactionFor,
} from "../transaction-workflow-model";

/** Retries after the first attempt: five attempts in all, 1s, 2s, 4s, 8s apart. */
const registrationRetries = 4;
const registrationBackoff = Duration.seconds(1);

/** A transaction whose broadcast hash an API records; Direct ones it does not. */
export type ApiRecordedSource = TransactionWorkflowTransactionFor<
  "Borrow" | "Yield"
>["source"];

/**
 * Registers Held Hashes. A wallet that broadcast a transaction returns its
 * hash; until the API acknowledges it, the transaction can land on-chain with
 * no record. Leaving the Transaction Flow must not drop that hash, so
 * registration is owned by the service's Scope — the Application Runtime
 * Generation — rather than the workflow's.
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
  const walletRequests = yield* FiberSet.make();

  const registerHash = (
    source: ApiRecordedSource,
    hash: TransactionHash
  ): Effect.Effect<void> => {
    const register = Match.value(source).pipe(
      Match.tag("Yield", (source) =>
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
      transactionId: source.transaction.id,
      workflowKind: source._tag,
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

  /** Registers the hash a closed workflow's state still held. */
  const registerHeldState = (
    state: TransactionWorkflowState
  ): Effect.Effect<void> => {
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
    return registerHash(transaction.source, hash);
  };

  /**
   * Runs a wallet request under the Application Runtime Generation and awaits
   * it. A wallet can keep signing after the user leaves the Transaction Flow;
   * if the workflow ends first, a hash the wallet still broadcasts is
   * registered as a Held Hash. A payload it only signed is dropped.
   *
   * `record` hands the answer to the workflow's state before the workflow can
   * be interrupted again, so a workflow ending right after it still holds the
   * hash for `registerHeldState`.
   */
  const runWalletRequest = <E>(
    source: ApiRecordedSource,
    request: Effect.Effect<
      WalletBroadcastResult | WalletSignedPayloadResult,
      E
    >,
    record: (
      result: WalletBroadcastResult | WalletSignedPayloadResult
    ) => Effect.Effect<void>
  ) =>
    // The hand-off is attached before the workflow can be interrupted, so no
    // request is forked without it.
    Effect.uninterruptibleMask((restore) =>
      FiberSet.run(walletRequests, request).pipe(
        Effect.flatMap((pending) =>
          restore(Fiber.join(pending)).pipe(
            Effect.onInterrupt(() =>
              Fiber.await(pending).pipe(
                Effect.flatMap((exit) =>
                  Exit.isSuccess(exit) && exit.value.broadcasted
                    ? registerHash(source, exit.value.signedTx)
                    : Effect.void
                ),
                FiberSet.run(walletRequests),
                Effect.asVoid
              )
            ),
            Effect.tap(record)
          )
        )
      )
    );

  return { registerHeldState, runWalletRequest } as const;
});

export type HeldHashRegistration = Effect.Success<
  typeof makeHeldHashRegistration
>;
