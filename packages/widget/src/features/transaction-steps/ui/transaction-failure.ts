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
 * it, when they add something the message does not say.
 */
export type TransactionFailure = Readonly<{
  readonly detail: string | null;
  readonly message: string;
}>;

/** A reason short enough to finish the sentence it explains. */
const SHORT_REASON_LENGTH = 80;

// EVM nodes prefix a revert's reason; the user only needs the reason.
const REVERT_PREFIX = /^execution reverted:?\s*/i;

const plain = (message: string): TransactionFailure => ({
  detail: null,
  message,
});

const describeSignFailure = (
  t: TFunction,
  error: TransactionSignError
): TransactionFailure => {
  return Match.valueTags(error.reason, {
    DecodeFailed: () => plain(t("steps.failure.unsignable")),
    EstimateFailed: () => plain(t("steps.failure.estimate_failed")),
    MissingBorrowMeta: () => plain(t("steps.failure.unsignable")),
    MissingUnsignedPayload: () => plain(t("steps.failure.unsignable")),
    UnsupportedBorrowSigningFormat: () => plain(t("steps.failure.unsignable")),
    WalletOperationFailed: ({ cause }) =>
      cause._tag === "WalletRequestCancelledError"
        ? plain(t("steps.failure.rejected"))
        : {
            detail: getTransactionSignCustomMessage(error),
            message: t("steps.failure.wallet_failed"),
          },
    WalletRequestCancelled: () => plain(t("steps.failure.rejected")),
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
};

/** A failed transaction, named by its reason when the reason is short. */
const describeOnChainFailure = (
  t: TFunction,
  reason: string | null
): TransactionFailure => {
  const stripped = reason?.replace(REVERT_PREFIX, "").trim();
  const short = stripped?.replace(/\.$/, "");
  if (!short) return { detail: null, message: t("steps.failure.failed") };
  return short.length <= SHORT_REASON_LENGTH
    ? {
        detail: null,
        message: t("steps.failure.failed_on_chain", { reason: short }),
      }
    : { detail: stripped ?? null, message: t("steps.failure.failed") };
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
