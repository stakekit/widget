import { Equal, Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { ActionTransaction } from "../../../src/domain/action/models";
import { Action } from "../../../src/domain/borrow/execution/action";
import { Transaction } from "../../../src/domain/borrow/execution/transaction";
import {
  TransactionWorkflowId,
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  appendTransactionWorkflowBatch,
  getTransactionWorkflowAction,
  initializeTransactionWorkflow,
  makeBorrowTransactionWorkflowBatch,
  updateCurrentTransactionWorkflowTransaction,
  validateTransactionWorkflowInput,
} from "../../../src/services/transaction-workflow/internal/model";
import {
  BorrowTransactionWorkflowInput,
  ClassicTransactionWorkflowInput,
  getCurrentTransactionWorkflowTransaction,
  getTransactionSignCustomMessage,
  getTransactionStepProgress,
  makeTransactionSignError,
  TransactionAdvanceError,
  TransactionConfirmationError,
  type TransactionPhaseProgress,
  type TransactionPhaseStatus,
  TransactionSignError,
  TransactionSubmissionError,
  type TransactionWorkflowState,
} from "../../../src/services/transaction-workflow/transaction-workflow-model";
import { ExternalProviderError } from "../../../src/services/wallet/external-provider";
import {
  WalletBroadcastError,
  WalletSigningError,
} from "../../../src/services/wallet/wallet-errors";
import type { ClassicActionMeta } from "../../../src/services/wallet/wallet-transactions";
import { yieldApiTransactionFixture } from "../../fixtures";

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
} as unknown as ClassicActionMeta;

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
      workflowId: TransactionWorkflowId.make("action-1"),
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
      workflowId: TransactionWorkflowId.make("action-1"),
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
      workflowId: TransactionWorkflowId.make("action-1"),
    });
    expect(withoutCustom.message).toBe(
      "Wallet is not connected for transaction signing."
    );
    expect(getTransactionSignCustomMessage(withoutCustom)).toBeNull();
  });

  it("projects host custom messages from external-provider message-signing failures", () => {
    const error = makeTransactionSignError({
      batchId: "classic",
      network: "ethereum",
      reason: {
        _tag: "WalletOperationFailed",
        cause: new WalletSigningError({
          cause: new ExternalProviderError({
            customMessage: "Approve the message in your host wallet",
            message: "Approve the message in your host wallet",
          }),
          operation: "message",
        }),
        operation: "message",
      },
      transactionId: "classic-1",
      workflowId: TransactionWorkflowId.make("action-1"),
    });

    expect(error.message).toBe("Message signing failed.");
    expect(getTransactionSignCustomMessage(error)).toBe(
      "Approve the message in your host wallet"
    );
  });

  describe("step progress", () => {
    const context = initializeTransactionWorkflow(
      new ClassicTransactionWorkflowInput({
        actionMeta,
        transactions: [
          classicTransaction("classic-1", "CREATED", 0),
          classicTransaction("classic-2", "CREATED", 1),
        ],
        walletScope: classicWalletScope,
        yieldId,
      })
    ).context;
    const [current, waiting] = context.batches[0]?.transactions ?? [];
    if (!current || !waiting) throw new Error("Expected two transactions.");
    const done = { ...current, meta: { ...current.meta, done: true } };
    const common = {
      batchId: "classic",
      message: "failed",
      transactionId: "classic-1",
      workflowId: TransactionWorkflowId.make("action-1"),
    };
    const phases = (
      sign: TransactionPhaseStatus,
      broadcast: TransactionPhaseStatus,
      confirm: TransactionPhaseStatus
    ): TransactionPhaseProgress => ({ broadcast, confirm, sign });
    const states: ReadonlyArray<
      readonly [TransactionWorkflowState, TransactionPhaseProgress]
    > = [
      [{ _tag: "Signing", context }, phases("active", "idle", "idle")],
      [
        {
          _tag: "SignFailed",
          context,
          error: new TransactionSignError({
            ...common,
            network: "ethereum",
            reason: { _tag: "MissingUnsignedPayload" },
          }),
        },
        phases("failed", "idle", "idle"),
      ],
      [{ _tag: "Submitting", context }, phases("done", "active", "idle")],
      [
        {
          _tag: "SubmissionFailed",
          context,
          error: new TransactionSubmissionError({
            ...common,
            broadcasted: false,
          }),
        },
        phases("done", "failed", "idle"),
      ],
      [{ _tag: "Confirming", context }, phases("done", "done", "active")],
      [
        {
          _tag: "ConfirmationFailed",
          context,
          error: new TransactionConfirmationError({
            ...common,
            network: "ethereum",
          }),
        },
        phases("done", "done", "failed"),
      ],
      [{ _tag: "Advancing", context }, phases("done", "done", "active")],
      [
        {
          _tag: "AdvanceFailed",
          context,
          error: new TransactionAdvanceError(common),
        },
        phases("done", "done", "failed"),
      ],
      [{ _tag: "Completed", context }, phases("done", "done", "done")],
    ];

    it.each(
      states.map(([state, expected]) => [state._tag, state, expected] as const)
    )("projects the current transaction in %s", (_tag, state, expected) => {
      expect(getTransactionStepProgress(state, current)).toEqual({
        disabled: false,
        phases: expected,
      });
    });

    it("keeps transactions other than the current one idle or done", () => {
      for (const [state] of states) {
        expect(getTransactionStepProgress(state, waiting)).toEqual({
          disabled: false,
          phases: phases("idle", "idle", "idle"),
        });
        expect(getTransactionStepProgress(state, done)).toEqual({
          disabled: false,
          phases: phases("done", "done", "done"),
        });
      }
    });

    it("marks every transaction of a Disabled workflow as disabled", () => {
      const disabled: TransactionWorkflowState = { _tag: "Disabled", context };

      expect(getTransactionStepProgress(disabled, current)).toEqual({
        disabled: true,
        phases: phases("idle", "idle", "idle"),
      });
      expect(getTransactionStepProgress(disabled, done)).toEqual({
        disabled: true,
        phases: phases("done", "done", "done"),
      });

      const settled = initializeTransactionWorkflow(
        new ClassicTransactionWorkflowInput({
          actionMeta,
          transactions: [classicTransaction("classic-1", "CONFIRMED", 0)],
          walletScope: classicWalletScope,
          yieldId,
        })
      );
      const [confirmed] = settled.context.batches[0]?.transactions ?? [];
      if (!confirmed) throw new Error("Expected one transaction.");

      expect(settled._tag).toBe("Disabled");
      expect(getTransactionStepProgress(settled, confirmed)).toEqual({
        disabled: true,
        phases: phases("done", "done", "done"),
      });
    });
  });
});
