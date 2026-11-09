import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { Action } from "../../../src/domain/borrow/action";
import { Transaction } from "../../../src/domain/borrow/transaction";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { projectBorrowExecution } from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-workflow";
import { initializeTransactionWorkflow } from "../../../src/services/transaction-workflow/internal/model";
import { BorrowTransactionWorkflowInput } from "../../../src/services/transaction-workflow/transaction-workflow-model";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

const borrowAction = (status: string) =>
  Schema.decodeUnknownSync(Action)({
    address,
    action: "borrow",
    createdAt: "2026-07-10T12:00:00.000Z",
    currentStep: 1,
    hasNextStep: false,
    id: "borrow-action-1",
    integrationId: "morpho-blue",
    status: "CREATED",
    totalSteps: 1,
    transactions: [
      Schema.encodeSync(Transaction)(
        Schema.decodeUnknownSync(Transaction)({
          address,
          chainId: "8453",
          id: "borrow-1",
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
        })
      ),
    ],
  });

const project = (status: string) =>
  projectBorrowExecution(
    initializeTransactionWorkflow(
      new BorrowTransactionWorkflowInput({
        action: borrowAction(status),
        walletScope: new WalletScopeKey({ address, network: "base" }),
      })
    ),
    "borrow"
  );

describe("Borrow execution projection", () => {
  it("offers Cancel while nothing went to the network", () => {
    expect(project("WAITING_FOR_SIGNATURE").sent).toBe(false);
  });

  it("treats a transaction the API reports broadcast without a local hash as sent", () => {
    const view = project("BROADCASTED");

    expect(view.steps.map(({ hash, sent }) => [hash, sent])).toEqual([
      [null, true],
    ]);
    expect(view.sent).toBe(true);
  });
});
