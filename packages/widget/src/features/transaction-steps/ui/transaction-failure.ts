import { Match } from "effect";
import type { TFunction } from "i18next";

import {
  getTransactionSignCustomMessage,
  type TransactionSignError,
  type TransactionWorkflowError,
} from "../../../services/transaction-workflow/transaction-workflow-model";

/**
 * What went wrong with a flow's transaction, in plain words with what to do
 * next. `detail` is the wallet's or the API's own words, shown muted under
 * it, when they add something the message does not say. `cancelled` says the
 * user declined in the wallet: nothing failed and nothing was sent, so it
 * reads as neutral, not as an error.
 */
export type TransactionFailure = Readonly<{
  readonly cancelled: boolean;
  readonly detail: string | null;
  readonly message: string;
}>;

/** A reason short enough to finish the sentence it explains. */
const SHORT_REASON_LENGTH = 80;

// EVM nodes prefix a revert's reason; the user only needs the reason.
const REVERT_PREFIX = /^execution reverted:?\s*/i;

const plain = (message: string): TransactionFailure => ({
  cancelled: false,
  detail: null,
  message,
});

const declined = (t: TFunction): TransactionFailure => ({
  cancelled: true,
  detail: null,
  message: t("steps.failure.rejected"),
});

const describeSignFailure = (
  t: TFunction,
  error: TransactionSignError
): TransactionFailure =>
  Match.valueTags(error.reason, {
    DecodeFailed: () => plain(t("steps.failure.unsignable")),
    EstimateFailed: () => plain(t("steps.failure.estimate_failed")),
    MissingBorrowMeta: () => plain(t("steps.failure.unsignable")),
    MissingUnsignedPayload: () => plain(t("steps.failure.unsignable")),
    UnsupportedBorrowSigningFormat: () => plain(t("steps.failure.unsignable")),
    WalletOperationFailed: ({ cause }) =>
      cause._tag === "WalletRequestCancelledError"
        ? declined(t)
        : {
            cancelled: false,
            detail: getTransactionSignCustomMessage(error),
            message: t("steps.failure.wallet_failed"),
          },
    WalletRequestCancelled: () => declined(t),
    WalletUnavailable: ({ detail }) =>
      plain(
        Match.value(detail).pipe(
          Match.when("account-changed", () =>
            t("steps.failure.account_changed")
          ),
          Match.when("network-changed", () =>
            t("steps.failure.network_changed")
          ),
          Match.when("disconnected", () => t("steps.failure.disconnected")),
          Match.when("state-unavailable", () =>
            t("steps.failure.wallet_failed")
          ),
          Match.exhaustive
        )
      ),
  });

/** A failed transaction, named by its reason when the reason is short. */
const describeOnChainFailure = (
  t: TFunction,
  reason: string | null
): TransactionFailure => {
  const stripped = reason?.replace(REVERT_PREFIX, "").trim();
  const short = stripped?.replace(/\.$/, "");
  if (!short) return plain(t("steps.failure.failed"));
  return short.length <= SHORT_REASON_LENGTH
    ? plain(t("steps.failure.failed_on_chain", { reason: short }))
    : {
        cancelled: false,
        detail: stripped ?? null,
        message: t("steps.failure.failed"),
      };
};

/**
 * A workflow error as the user reads it: never the internal message, always
 * what happened and what to do next.
 */
export const describeTransactionFailure = (
  t: TFunction,
  error: TransactionWorkflowError | null
): TransactionFailure | null => {
  if (error === null) return null;
  return Match.valueTags(error, {
    TransactionAdvanceError: () => plain(t("steps.failure.advance_failed")),
    TransactionConfirmationError: ({ outcome, reason }) =>
      Match.value(outcome).pipe(
        Match.when("Failed", () => describeOnChainFailure(t, reason)),
        Match.when("Dropped", () => plain(t("steps.failure.dropped"))),
        Match.when("Unconfirmed", () => plain(t("steps.failure.unconfirmed"))),
        Match.exhaustive
      ),
    TransactionPrepareError: ({ retryable }) =>
      plain(
        retryable
          ? t("steps.failure.prepare_failed")
          : t("steps.prepare_rejected")
      ),
    TransactionSignError: (signError) => describeSignFailure(t, signError),
    TransactionSubmissionError: () => plain(t("steps.failure.not_sent")),
  });
};
