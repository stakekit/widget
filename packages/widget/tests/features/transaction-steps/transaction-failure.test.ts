import { describe, expect, it } from "vitest";

import { TransactionWorkflowId } from "../../../src/domain/identity/identifiers";
import {
  describeTransactionFailure,
  getTransactionStepState,
} from "../../../src/features/transaction-steps/index";
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
  ])("reads %s as cancelled, not failed", (_, error) => {
    expect(describeTransactionFailure(t, error)).toEqual({
      cancelled: true,
      detail: null,
      message: "Nothing was sent. Try again when you're ready.",
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
      cancelled: false,
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
    ).toEqual({ cancelled: false, detail: null, message });
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
      cancelled: false,
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
      cancelled: false,
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
      cancelled: false,
      detail: null,
      message,
    });
  });
});

describe("Transaction step state", () => {
  type Phase = "idle" | "active" | "done" | "failed";
  const phases = (
    sign: Phase,
    broadcast: Phase = "idle",
    confirm: Phase = "idle"
  ) => ({ broadcast, confirm, sign });
  const state = (
    input: Partial<Parameters<typeof getTransactionStepState>[1]>
  ) =>
    getTransactionStepState(t, {
      done: false,
      failure: null,
      phases: phases("idle"),
      slow: false,
      ...input,
    });

  it("shows a request declined in the wallet as cancelled, not failed", () => {
    expect(
      state({
        failure: { cancelled: true, message: "Nothing was sent." },
        phases: phases("failed"),
      })
    ).toEqual({ message: "Nothing was sent.", state: "cancelled" });
  });

  it("keeps the failed state for a real failure", () => {
    expect(
      state({
        failure: { cancelled: false, message: "The transaction failed." },
        phases: phases("done", "done", "failed"),
      })
    ).toEqual({ message: "The transaction failed.", state: "failed" });
  });

  it.each([
    ["being sent", phases("done", "active"), "broadcasting"],
    ["confirming", phases("done", "done", "active"), "active"],
  ] as const)(
    "says a step %s for long takes longer than usual",
    (_, progress, expected) => {
      expect(state({ phases: progress })).toEqual({ state: expected });
      expect(state({ phases: progress, slow: true })).toEqual({
        message: "Taking longer than usual. It's still on its way.",
        state: expected,
      });
    }
  );

  it("never calls a signature the user has yet to give slow", () => {
    expect(state({ phases: phases("active"), slow: true })).toEqual({
      state: "signing",
    });
  });
});
