import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { ActionTransaction } from "../../src/domain/schema/action-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import {
  ClassicTransactionFlowWorkflowHandoff,
  makeClassicTransactionFlowIdentity,
} from "../../src/features/transaction-flow/model/classic-transaction-flow";
import {
  classicTransactionWorkflowCompletionAtom,
  classicTransactionWorkflowDispatchAtom,
  classicTransactionWorkflowMachineAtom,
  classicTransactionWorkflowStateAtom,
  classicTransactionWorkflowViewAtom,
  transactionWorkflowDispatchAtom,
  transactionWorkflowMachineAtom,
  transactionWorkflowStateAtom,
} from "../../src/features/transaction-flow/state/transaction-workflow-atoms";
import type { ActionMeta } from "../../src/public-api/types";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import { ClassicTransactionWorkflowKey } from "../../src/services/workflow/transaction-workflow-model";
import { yieldApiTransactionFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const actionMeta = {
  actionId: "action-1",
  address,
} as unknown as ActionMeta;
const transaction = yieldApiTransactionFixture({
  id: "tx-1",
  network: "ethereum",
  status: "CREATED",
  unsignedTransaction: "unsigned",
}) as ActionTransaction;

describe("transaction workflow atoms", () => {
  it("returns one atom graph for value-equal workflow keys", () => {
    const makeKey = () =>
      new ClassicTransactionWorkflowKey({
        actionMeta,
        transactions: [transaction],
        walletScope,
        yieldId,
      });

    expect(transactionWorkflowMachineAtom(makeKey())).toBe(
      transactionWorkflowMachineAtom(makeKey())
    );
    expect(transactionWorkflowStateAtom(makeKey())).toBe(
      transactionWorkflowStateAtom(makeKey())
    );
    expect(transactionWorkflowDispatchAtom(makeKey())).toBe(
      transactionWorkflowDispatchAtom(makeKey())
    );
  });

  it("separates Classic machine generations by flow identity", () => {
    const makeHandoff = (flowIdentity: string) =>
      new ClassicTransactionFlowWorkflowHandoff({
        flowIdentity: makeClassicTransactionFlowIdentity(flowIdentity),
        workflowKey: new ClassicTransactionWorkflowKey({
          actionMeta,
          transactions: [transaction],
          walletScope,
          yieldId,
        }),
      });
    const first = makeHandoff("flow-1");
    const equalFirst = makeHandoff("flow-1");
    const second = makeHandoff("flow-2");

    expect(classicTransactionWorkflowMachineAtom(first)).toBe(
      classicTransactionWorkflowMachineAtom(equalFirst)
    );
    expect(classicTransactionWorkflowStateAtom(first)).toBe(
      classicTransactionWorkflowStateAtom(equalFirst)
    );
    expect(classicTransactionWorkflowDispatchAtom(first)).toBe(
      classicTransactionWorkflowDispatchAtom(equalFirst)
    );
    expect(classicTransactionWorkflowCompletionAtom(first)).toBe(
      classicTransactionWorkflowCompletionAtom(equalFirst)
    );
    expect(classicTransactionWorkflowViewAtom(first)).toBe(
      classicTransactionWorkflowViewAtom(equalFirst)
    );
    expect(classicTransactionWorkflowMachineAtom(first)).not.toBe(
      classicTransactionWorkflowMachineAtom(second)
    );
  });
});
