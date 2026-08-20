import { Equal, Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { ActionTransaction } from "../../src/domain/action/models";
import { Action } from "../../src/domain/borrow/execution/action";
import { Transaction } from "../../src/domain/borrow/execution/transaction";
import { WalletAddress, YieldId } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type { ActionMeta } from "../../src/public-api/types";
import {
  appendTransactionWorkflowBatch,
  getTransactionWorkflowAction,
  initializeTransactionWorkflow,
  makeBorrowTransactionWorkflowBatch,
  updateCurrentTransactionWorkflowTransaction,
  validateTransactionWorkflowInput,
} from "../../src/services/transaction-workflow/internal/model";
import {
  BorrowTransactionWorkflowInput,
  ClassicTransactionWorkflowInput,
  getCurrentTransactionWorkflowTransaction,
  getTransactionSignCustomMessage,
  makeTransactionSignError,
  TransactionAdvanceError,
  TransactionConfirmationError,
  TransactionSignError,
  TransactionSubmissionError,
} from "../../src/services/transaction-workflow/transaction-workflow-model";
import { WalletBroadcastError } from "../../src/services/wallet/wallet-errors";
import { yieldApiTransactionFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const classicWalletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const borrowWalletScope = new WalletScopeKey({ address, network: "base" });
const actionMeta = {
  actionId: "action-1",
  address,
} as unknown as ActionMeta;

const classicTransaction = (
  id: string,
  status: ActionTransaction["status"],
  stepIndex: number
) =>
  yieldApiTransactionFixture({
    id,
    network: "ethereum",
    status,
    stepIndex,
  });

const borrowTransaction = (id: string, status = "WAITING_FOR_SIGNATURE") =>
  Schema.decodeUnknownSync(Transaction)({
    address,
    chainId: "8453",
    id,
    network: "base",
    signablePayload: JSON.stringify({
      data: "0xabcdef",
      from: address,
      gasLimit: "21000",
      to: "0x0000000000000000000000000000000000000002",
    }),
    signingFormat: "EVM_TRANSACTION",
    status,
    type: "BORROW",
  });

const borrowAction = ({
  currentStep = 1,
  status = "CREATED",
  totalSteps = 2,
  transactions = [borrowTransaction("borrow-1")],
}: {
  readonly currentStep?: number;
  readonly status?: string;
  readonly totalSteps?: number;
  readonly transactions?: ReadonlyArray<Transaction>;
} = {}) =>
  Schema.decodeUnknownSync(Action)({
    address,
    action: "borrow",
    createdAt: "2026-07-10T12:00:00.000Z",
    currentStep,
    hasNextStep: currentStep < totalSteps,
    id: "borrow-action-1",
    integrationId: "morpho-blue",
    status,
    totalSteps,
    transactions: transactions.map((transaction) =>
      Schema.encodeSync(Transaction)(transaction)
    ),
  });

describe("transaction workflow model", () => {
  it("captures distinct top-level inputs while retaining structural equality", () => {
    const classicInput = {
      actionMeta,
      transactions: [classicTransaction("classic-1", "CREATED", 0)],
      walletScope: classicWalletScope,
      yieldId,
    };
    const action = borrowAction();

    const classic = new ClassicTransactionWorkflowInput(classicInput);
    const borrow = new BorrowTransactionWorkflowInput({
      action,
      walletScope: borrowWalletScope,
    });

    expect(
      Equal.equals(
        classic,
        new ClassicTransactionWorkflowInput({ ...classicInput })
      )
    ).toBe(true);
    expect(
      Equal.equals(
        new BorrowTransactionWorkflowInput({
          action,
          walletScope: borrowWalletScope,
        }),
        new BorrowTransactionWorkflowInput({
          action,
          walletScope: borrowWalletScope,
        })
      )
    ).toBe(true);
    expect(classic.transactions).not.toBe(classicInput.transactions);
    expect(classic.walletScope).not.toBe(classicWalletScope);
    expect(borrow.action).not.toBe(action);
    expect(borrow.walletScope).not.toBe(borrowWalletScope);
  });

  it("rejects transactions outside the captured wallet network", () => {
    const input = new ClassicTransactionWorkflowInput({
      actionMeta,
      transactions: [
        yieldApiTransactionFixture({
          id: "wrong-network",
          network: "base",
          status: "CREATED",
        }),
      ],
      walletScope: classicWalletScope,
      yieldId,
    });

    expect(validateTransactionWorkflowInput(input)?._tag).toBe(
      "TransactionWorkflowInputError"
    );
  });

  it("sorts a fixed classic batch and selects its first incomplete transaction", () => {
    const state = initializeTransactionWorkflow(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [
          classicTransaction("third", "CREATED", 3),
          classicTransaction("first", "CONFIRMED", 1),
          classicTransaction("second", "SKIPPED", 2),
        ],
        walletScope: classicWalletScope,
        yieldId,
      })
    );

    expect(state._tag).toBe("Signing");
    expect(
      state.context.batches[0]?.transactions.map(
        ({ source }) => source.transaction.id
      )
    ).toEqual(["first", "second", "third"]);
    expect(
      getCurrentTransactionWorkflowTransaction(state.context)?.source
        .transaction.id
    ).toBe("third");
  });

  it("starts broadcast transactions in confirmation and disables completed fixed batches", () => {
    const makeKey = (status: ActionTransaction["status"]) =>
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("classic-1", status, 0)],
        walletScope: classicWalletScope,
        yieldId,
      });

    expect(initializeTransactionWorkflow(makeKey("BROADCASTED"))._tag).toBe(
      "Confirming"
    );
    expect(initializeTransactionWorkflow(makeKey("CONFIRMED"))._tag).toBe(
      "Disabled"
    );
    expect(
      initializeTransactionWorkflow(
        new BorrowTransactionWorkflowInput({
          action: borrowAction({ status: "SUCCESS" }),
          walletScope: borrowWalletScope,
        })
      )._tag
    ).toBe("Completed");
  });

  it("updates the current transaction without mutating prior context", () => {
    const initial = initializeTransactionWorkflow(
      new BorrowTransactionWorkflowInput({
        action: borrowAction(),
        walletScope: borrowWalletScope,
      })
    ).context;
    const updated = updateCurrentTransactionWorkflowTransaction({
      context: initial,
      update: (transaction) => ({
        ...transaction,
        meta: { ...transaction.meta, done: true },
      }),
    });

    expect(initial.batches[0]?.transactions[0]?.meta.done).toBe(false);
    expect(updated.batches[0]?.transactions[0]?.meta.done).toBe(true);
  });

  it("appends a borrow batch while retaining history and deduplicating a server step", () => {
    const firstAction = borrowAction();
    const initial = initializeTransactionWorkflow(
      new BorrowTransactionWorkflowInput({
        action: firstAction,
        walletScope: borrowWalletScope,
      })
    ).context;
    const nextAction = borrowAction({
      currentStep: 2,
      transactions: [borrowTransaction("borrow-2")],
    });
    const batch = makeBorrowTransactionWorkflowBatch(nextAction);
    const appended = appendTransactionWorkflowBatch({
      batch,
      context: initial,
      domain: { _tag: "Borrow", action: nextAction },
    });
    const deduplicated = appendTransactionWorkflowBatch({
      batch,
      context: appended,
      domain: { _tag: "Borrow", action: nextAction },
    });

    expect(appended.batches.map(({ id }) => id)).toEqual([
      "borrow-step-1",
      "borrow-step-2",
    ]);
    expect(appended.batches[0]).toBe(initial.batches[0]);
    expect(deduplicated.batches).toHaveLength(2);
    expect(
      getCurrentTransactionWorkflowTransaction(deduplicated)?.source.transaction
        .id
    ).toBe("borrow-2");
  });

  it("allows the one retry command only from the matching failed phase", () => {
    const context = initializeTransactionWorkflow(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [classicTransaction("classic-1", "CREATED", 0)],
        walletScope: classicWalletScope,
        yieldId,
      })
    ).context;
    const common = {
      batchId: "classic",
      message: "failed",
      transactionId: "classic-1",
      workflowId: "action-1",
    };
    const states = [
      {
        state: {
          _tag: "SignFailed",
          context,
          error: new TransactionSignError({
            ...common,
            network: "ethereum",
            reason: { _tag: "MissingUnsignedPayload" },
          }),
        } as const,
        action: "sign",
      },
      {
        state: {
          _tag: "SubmissionFailed",
          context,
          error: new TransactionSubmissionError({
            ...common,
            broadcasted: false,
          }),
        } as const,
        action: "submit",
      },
      {
        state: {
          _tag: "ConfirmationFailed",
          context,
          error: new TransactionConfirmationError({
            ...common,
            network: "ethereum",
          }),
        } as const,
        action: "confirm",
      },
      {
        state: {
          _tag: "AdvanceFailed",
          context,
          error: new TransactionAdvanceError(common),
        } as const,
        action: "advance",
      },
    ];

    for (const { action, state } of states) {
      expect(
        getTransactionWorkflowAction({ command: { _tag: "Retry" }, state })
      ).toBe(action);
    }
    expect(
      getTransactionWorkflowAction({
        command: { _tag: "Retry" },
        state: { _tag: "Signing", context },
      })
    ).toBeNull();
  });

  it("projects host custom messages from wallet broadcast sign failures", () => {
    const withCustom = makeTransactionSignError({
      batchId: "classic",
      network: "ethereum",
      reason: {
        _tag: "WalletOperationFailed",
        cause: new WalletBroadcastError({
          cause: null,
          customMessage: "Open your host wallet",
        }),
        operation: "transaction",
      },
      transactionId: "classic-1",
      workflowId: "action-1",
    });
    expect(withCustom.message).toBe("Transaction signing failed.");
    expect(getTransactionSignCustomMessage(withCustom)).toBe(
      "Open your host wallet"
    );

    const withoutCustom = makeTransactionSignError({
      batchId: "classic",
      network: "ethereum",
      reason: { _tag: "WalletUnavailable", detail: "disconnected" },
      transactionId: "classic-1",
      workflowId: "action-1",
    });
    expect(withoutCustom.message).toBe(
      "Wallet is not connected for transaction signing."
    );
    expect(getTransactionSignCustomMessage(withoutCustom)).toBeNull();
  });
});
