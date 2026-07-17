import { Equal, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Action } from "../../src/domain/borrow";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { transactionWorkflowMachineAtom } from "../../src/features/transaction-flow/state/transaction-workflow-atoms";
import {
  ActivityInvalidationKey,
  BorrowMarketsInvalidationKey,
  BorrowPositionsInvalidationKey,
  WalletBalancesInvalidationKey,
  YieldPositionsInvalidationKey,
} from "../../src/services/resource-invalidation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { BorrowTransactionWorkflowKey } from "../../src/services/workflow/transaction-workflow-model";
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

describe("borrow transaction workflow atom identity", () => {
  it("shares one machine for value-equal keys without a global event service", () => {
    const firstKey = new BorrowTransactionWorkflowKey({ action, walletScope });
    const secondKey = new BorrowTransactionWorkflowKey({ action, walletScope });

    expect(Equal.equals(firstKey, secondKey)).toBe(true);
    expect(transactionWorkflowMachineAtom(firstKey)).toBe(
      transactionWorkflowMachineAtom(secondKey)
    );
  });

  it("derives semantic refresh categories from the immutable workflow scope", () => {
    const key = new BorrowTransactionWorkflowKey({ action, walletScope });

    expect(getTransactionWorkflowInvalidationKeys(key)).toEqual([
      new WalletBalancesInvalidationKey({ scope: walletScope }),
      new YieldPositionsInvalidationKey({ scope: walletScope }),
      new ActivityInvalidationKey({ scope: walletScope }),
      new BorrowPositionsInvalidationKey({ scope: walletScope }),
      new BorrowMarketsInvalidationKey({ network: "base" }),
    ]);
    expect(getTransactionWorkflowSubmissionInvalidationKeys(key)).toEqual([
      new BorrowPositionsInvalidationKey({ scope: walletScope }),
      new BorrowMarketsInvalidationKey({ network: "base" }),
    ]);
  });
});
