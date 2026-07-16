import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { ActionTransaction } from "../../src/domain/schema/action-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import {
  tokenBalancesScanResourceAtom,
  yieldBalancesScanResourceAtom,
} from "../../src/features/portfolio";
import {
  getClassicWorkflowCompletionResources,
  getTransactionWorkflowAtoms,
} from "../../src/features/transaction-flow/state/transaction-workflow-atoms";
import type { ActionMeta } from "../../src/public-api/types";
import { ClassicTransactionWorkflowKey } from "../../src/services/workflow/transaction-workflow-model";
import { yieldApiTransactionFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const yieldId = Schema.decodeSync(YieldId)("yield-1");
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
        yieldId,
      });

    const first = getTransactionWorkflowAtoms(makeKey());
    const second = getTransactionWorkflowAtoms(makeKey());

    expect(first.machineAtom).toBe(second.machineAtom);
    expect(first.stateAtom).toBe(second.stateAtom);
    expect(first.eventsAtom).toBe(second.eventsAtom);
    expect(first.dispatchAtom).toBe(second.dispatchAtom);
  });

  it("keeps classic balance completion resources wallet-scoped", () => {
    expect(
      getClassicWorkflowCompletionResources({ status: "disconnected" } as never)
    ).toEqual([]);
    expect(
      getClassicWorkflowCompletionResources({
        address,
        network: "ethereum",
        status: "connected",
      } as never)
    ).toEqual([tokenBalancesScanResourceAtom, yieldBalancesScanResourceAtom]);
  });
});
