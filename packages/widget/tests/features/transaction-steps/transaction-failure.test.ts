import { describe, expect, it } from "vitest";
import { TransactionWorkflowId } from "../../../src/domain/identity/identifiers";
import { describeTransactionFailure } from "../../../src/features/transaction-steps/views";
import {
  makeTransactionSignError,
  TransactionAdvanceError,
  TransactionConfirmationError,
  type TransactionConfirmationOutcome,
  type TransactionSignFailureReason,
  TransactionSubmissionError,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { ExternalProviderError } from "../../../src/services/wallet/external-provider";
import {
  WalletRequestCancelledError,
  WalletSigningError,
} from "../../../src/services/wallet/wallet-errors";

const t = createWidgetI18nInstance().getFixedT("en");
const workflowId = TransactionWorkflowId.make("w");
const common = {
  batchId: "batch",
  message: "internal",
  transactionId: null,
  workflowId,
};

const signError = (reason: TransactionSignFailureReason) =>
  makeTransactionSignError({
    batchId: "batch",
    network: "ethereum",
    reason,
    transactionId: null,
    workflowId,
  });

const confirmationError = (
  outcome: TransactionConfirmationOutcome,
  reason: string | null
) =>
  new TransactionConfirmationError({
    ...common,
    network: "ethereum",
    outcome,
    reason,
  });

describe("Transaction failure copy", () => {
  it("describes nothing while nothing failed", () => {
    expect(describeTransactionFailure(t, null)).toBeNull();
  });

  it.each([
    [
      "a rejection in the wallet",
      signError({ _tag: "WalletRequestCancelled", operation: "transaction" }),
    ],
    [
      "a rejection the wallet reports as a failure",
      signError({
        _tag: "WalletOperationFailed",
        cause: new WalletRequestCancelledError({ operation: "transaction" }),
        operation: "transaction",
      }),
    ],
  ])("asks to try again after %s", (_, error) => {
    expect(describeTransactionFailure(t, error)).toEqual({
      detail: null,
      message: "The transaction was rejected in your wallet. Try again.",
    });
  });

  it("keeps a wallet's own message as a detail under plain copy", () => {
    const error = signError({
      _tag: "WalletOperationFailed",
      cause: new WalletSigningError({
        cause: new ExternalProviderError({
          customMessage: "Playground: scripted wallet failure",
          message: "Playground: scripted wallet failure",
        }),
        operation: "transaction",
      }),
      operation: "transaction",
    });

    expect(describeTransactionFailure(t, error)).toEqual({
      detail: "Playground: scripted wallet failure",
      message: "Your wallet couldn't complete the request. Try again.",
    });
  });

  it.each([
    [
      "network-changed",
      "Your wallet switched networks. Switch back and try again.",
    ],
    [
      "account-changed",
      "Your wallet switched accounts. Switch back and try again.",
    ],
    ["disconnected", "Your wallet disconnected. Reconnect it and try again."],
  ] as const)("says what to do when the wallet is %s", (detail, message) => {
    expect(
      describeTransactionFailure(
        t,
        signError({ _tag: "WalletUnavailable", detail })
      )
    ).toEqual({ detail: null, message });
  });

  it("names an on-chain failure with its short reason", () => {
    expect(
      describeTransactionFailure(
        t,
        confirmationError(
          "Failed",
          "execution reverted: insufficient allowance"
        )
      )
    ).toEqual({
      detail: null,
      message: "The transaction failed on chain: insufficient allowance.",
    });
  });

  it("keeps a long reason as a detail, without the revert prefix", () => {
    const reason = "x".repeat(120);

    expect(
      describeTransactionFailure(
        t,
        confirmationError("Failed", `execution reverted: ${reason}`)
      )
    ).toEqual({
      detail: reason,
      message: "The transaction failed. Try again.",
    });
  });

  it.each([
    [confirmationError("Failed", null), "The transaction failed. Try again."],
    [
      confirmationError("Unconfirmed", null),
      "We couldn't confirm the transaction. Try again to check its status.",
    ],
    [
      confirmationError("Dropped", null),
      "The transaction was dropped by the network. Try again to send it.",
    ],
    [
      new TransactionSubmissionError({ ...common, broadcasted: false }),
      "The transaction couldn't be sent. Try again.",
    ],
    [
      new TransactionAdvanceError(common),
      "The next step couldn't be prepared. Try again.",
    ],
  ])("never shows the internal message: %#", (error, message) => {
    expect(describeTransactionFailure(t, error)).toEqual({
      detail: null,
      message,
    });
  });
});
