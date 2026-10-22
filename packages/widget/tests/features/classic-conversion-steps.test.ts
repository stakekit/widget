import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { YieldId } from "../../src/domain/identity/identifiers";
import { getClassicConversionStepsView } from "../../src/features/classic-transaction-flow/model/classic-transaction-workflow";
import { yieldApiTransactionFixture } from "../fixtures";

const yieldId = Schema.decodeSync(YieldId)("zama-vault");

describe("confidential conversion steps view", () => {
  it("shows encrypt, approve and wrap ahead of the API's waiting deposit", () => {
    const deposit = yieldApiTransactionFixture({ type: "DEPOSIT" });

    const view = getClassicConversionStepsView(
      {
        pendingTransactionType: null,
        steps: [
          { status: "done", step: "encrypt" },
          { status: "confirming", step: "approve" },
          { status: "idle", step: "wrap" },
        ],
        transactions: [deposit],
      },
      null,
      yieldId
    );

    expect(
      view.txStates.map((txState) => [
        txState.tx.type,
        txState.progress.phases,
        txState.meta.done,
      ])
    ).toEqual([
      ["ENCRYPT", { broadcast: "done", confirm: "done", sign: "done" }, true],
      [
        "APPROVAL",
        { broadcast: "done", confirm: "active", sign: "done" },
        false,
      ],
      ["WRAP", { broadcast: "idle", confirm: "idle", sign: "idle" }, false],
      ["DEPOSIT", { broadcast: "idle", confirm: "idle", sign: "idle" }, false],
    ]);
    expect(view.retryable).toBe(false);
  });

  it("ends with an idle deposit before the API prepares the action", () => {
    const view = getClassicConversionStepsView(
      {
        pendingTransactionType: "DEPOSIT",
        steps: [
          { status: "signing", step: "encrypt" },
          { status: "idle", step: "approve" },
          { status: "idle", step: "wrap" },
        ],
        transactions: [],
      },
      null,
      yieldId
    );

    expect(view.txStates.map((txState) => txState.tx.type)).toEqual([
      "ENCRYPT",
      "APPROVAL",
      "WRAP",
      "DEPOSIT",
    ]);
    expect(view.txStates.at(-1)).toMatchObject({
      meta: { done: false },
      progress: {
        phases: { broadcast: "idle", confirm: "idle", sign: "idle" },
      },
    });
  });

  it("lists the allowance reset as its own step", () => {
    const view = getClassicConversionStepsView(
      {
        pendingTransactionType: "DEPOSIT",
        steps: [
          { status: "idle", step: "encrypt" },
          { status: "idle", step: "approve-reset" },
          { status: "idle", step: "approve" },
          { status: "idle", step: "wrap" },
        ],
        transactions: [],
      },
      null,
      yieldId
    );

    expect(view.txStates.map((txState) => txState.tx.type)).toEqual([
      "ENCRYPT",
      "RESET_APPROVAL",
      "APPROVAL",
      "WRAP",
      "DEPOSIT",
    ]);
  });

  it("replaces the placeholder with the prepared transactions", () => {
    const approval = yieldApiTransactionFixture({
      id: "approval-tx",
      type: "APPROVAL",
    });
    const deposit = yieldApiTransactionFixture({
      id: "deposit-tx",
      type: "DEPOSIT",
    });

    const view = getClassicConversionStepsView(
      {
        pendingTransactionType: null,
        steps: [{ status: "done", step: "encrypt" }],
        transactions: [approval, deposit],
      },
      null,
      yieldId
    );

    expect(view.txStates.map((txState) => txState.tx.id)).toEqual([
      "conversion-encrypt",
      "approval-tx",
      "deposit-tx",
    ]);
  });

  it("leaves headers unnumbered while the action is prepared lazily", () => {
    const view = getClassicConversionStepsView(
      {
        pendingTransactionType: "WITHDRAW",
        steps: [{ status: "idle", step: "encrypt" }],
        transactions: [],
      },
      null,
      yieldId
    );

    expect(view.numbered).toBe(false);
    expect(view.txStates.map((txState) => txState.tx.type)).toEqual([
      "ENCRYPT",
      "WITHDRAW",
    ]);
  });

  it("offers retry once a client-side step fails", () => {
    const view = getClassicConversionStepsView(
      {
        pendingTransactionType: "DEPOSIT",
        steps: [{ status: "failed", step: "encrypt" }],
        transactions: [],
      },
      null,
      yieldId
    );

    expect(view.retryable).toBe(true);
    expect(view.txStates[0]?.progress.phases.sign).toBe("failed");
  });

  it("offers no retry when the API rejected the request itself", () => {
    const view = getClassicConversionStepsView(
      {
        pendingTransactionType: "DEPOSIT",
        steps: [{ status: "rejected", step: "encrypt" }],
        transactions: [],
      },
      null,
      yieldId
    );

    expect(view.retryable).toBe(false);
    expect(view.txStates[0]).toMatchObject({
      meta: { rejected: true },
      progress: { phases: { sign: "failed" } },
    });
  });
});
