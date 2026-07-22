import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Action } from "../../src/domain/borrow/action";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { makeTransactionWorkflowModule } from "../../src/features/transaction-workflow/state";
import {
  BorrowMarketsInvalidationKey,
  BorrowPositionsInvalidationKey,
  WalletBalancesInvalidationKey,
} from "../../src/services/resource-invalidation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { BorrowTransactionWorkflowInput } from "../../src/services/workflow/transaction-workflow-model";
import {
  getTransactionWorkflowInvalidationKeys,
  getTransactionWorkflowSubmissionInvalidationKeys,
} from "../../src/services/workflow/transaction-workflow-operations-service";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({ address, network: "base" });

const transactionInput = {
  address,
  chainId: "8453",
  id: "tx-1",
  network: "base",
  signablePayload: JSON.stringify({
    data: "0xabcdef",
    from: address,
    gasLimit: "21000",
    to: address,
  }),
  signingFormat: "EVM_TRANSACTION",
  status: "WAITING_FOR_SIGNATURE",
  type: "BORROW",
} as const;
const action = Schema.decodeUnknownSync(Action)({
  action: "borrow",
  address,
  createdAt: "2026-01-01T00:00:00.000Z",
  currentStep: 1,
  hasNextStep: false,
  id: "action-1",
  integrationId: "morpho-blue",
  status: "CREATED",
  totalSteps: 1,
  transactions: [transactionInput],
});

describe("borrow transaction workflow module", () => {
  it("creates a fresh module for every execution of equal inputs", () => {
    const firstInput = new BorrowTransactionWorkflowInput({
      action,
      walletScope,
    });
    const secondInput = new BorrowTransactionWorkflowInput({
      action,
      walletScope,
    });
    const first = makeTransactionWorkflowModule(firstInput);
    const second = makeTransactionWorkflowModule(secondInput);

    expect(first).not.toBe(second);
    expect(firstInput.action).not.toBe(action);
  });

  it("derives semantic refresh categories from the immutable workflow scope", () => {
    const key = new BorrowTransactionWorkflowInput({ action, walletScope });

    expect(getTransactionWorkflowInvalidationKeys(key)).toEqual([
      new WalletBalancesInvalidationKey({ scope: walletScope }),
      new BorrowPositionsInvalidationKey({ scope: walletScope }),
      new BorrowMarketsInvalidationKey({ network: "base" }),
    ]);
    expect(getTransactionWorkflowSubmissionInvalidationKeys(key)).toEqual([
      new BorrowPositionsInvalidationKey({ scope: walletScope }),
      new BorrowMarketsInvalidationKey({ network: "base" }),
    ]);
  });
});
