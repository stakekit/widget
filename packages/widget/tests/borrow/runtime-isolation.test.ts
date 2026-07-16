import { Equal, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Action, Transaction } from "../../src/domain/borrow";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  BorrowMarketsKey,
  BorrowPositionsKey,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionsAtom,
  getBorrowExecutionRefreshResources,
} from "../../src/features/borrow/core";
import {
  tokenBalancesScanResourceAtom,
  yieldBalancesScanResourceAtom,
} from "../../src/features/portfolio";
import { getTransactionWorkflowAtoms } from "../../src/features/transaction-flow/state/transaction-workflow-atoms";
import {
  BorrowTransactionWorkflowKey,
  initializeTransactionWorkflow,
} from "../../src/services/workflow/transaction-workflow-model";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

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
const transaction = Schema.decodeUnknownSync(Transaction)(transactionInput);
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
    const firstKey = new BorrowTransactionWorkflowKey({ action });
    const secondKey = new BorrowTransactionWorkflowKey({ action });

    expect(Equal.equals(firstKey, secondKey)).toBe(true);
    expect(getTransactionWorkflowAtoms(firstKey).machineAtom).toBe(
      getTransactionWorkflowAtoms(secondKey).machineAtom
    );
  });

  it("derives borrow and portfolio refreshes from the shared submitted event", () => {
    const key = new BorrowTransactionWorkflowKey({ action });
    const context = initializeTransactionWorkflow(key).context;
    const event = {
      _tag: "TransactionWorkflowSubmitted" as const,
      context,
      submission: {
        batchId: "borrow-step-1",
        hash: "0xhash",
        link: "https://explorer.test/tx",
        signedPayload: null,
        source: { _tag: "Borrow" as const, transaction },
        status: "BROADCASTED",
        transactionId: transaction.id,
      },
    };

    expect(
      getBorrowExecutionRefreshResources(event, {
        address,
        network: "base",
        status: "connected",
      } as never)
    ).toEqual([
      borrowIntegrationsAtom,
      borrowMarketsAtom(new BorrowMarketsKey({ network: "base" })),
      borrowPositionsAtom(new BorrowPositionsKey({ address, network: "base" })),
      tokenBalancesScanResourceAtom,
      yieldBalancesScanResourceAtom,
    ]);
  });
});
