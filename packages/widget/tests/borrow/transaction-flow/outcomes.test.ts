import { Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { MarketId } from "../../../src/domain/borrow/ids";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import { borrowActionFormAtom } from "../../../src/features/borrow/market-position/state/action";
import { marketPositionTransactionFlowOutcomeBindingAtom } from "../../../src/features/borrow/market-position/state/transaction-flow-outcomes";
import { publishBorrowTransactionFlowOutcomeAtom } from "../../../src/features/borrow-transaction-flow/state/outcomes";
import { WalletScopeKey } from "../../../src/services/wallet/domain/scope";

const marketId = Schema.decodeSync(MarketId)("market-1");
const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const scope = new WalletScopeKey({ address, network: "base" });

describe("Borrow Transaction Flow outcome ownership", () => {
  it("resets a staged Market Position action only for its origin", () => {
    const registry = AtomRegistry.make();
    const unmount = registry.mount(
      marketPositionTransactionFlowOutcomeBindingAtom
    );
    registry.set(borrowActionFormAtom, {
      actionId: "repay",
      marketId,
      network: "base",
      scope,
      type: "preparePositionAction",
    });

    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "Done",
      entry: { _tag: "BorrowEntry" },
      epoch: 1,
    });

    expect(registry.get(borrowActionFormAtom).type).toBe("positionAction");

    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "Done",
      entry: { _tag: "MarketPosition", marketId },
      epoch: 2,
    });

    expect(registry.get(borrowActionFormAtom).type).toBe("positionAction");

    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "ExecutionStarted",
      entry: { _tag: "MarketPosition", marketId },
      epoch: 3,
    });

    expect(registry.get(borrowActionFormAtom)).toEqual({ type: "idle" });
    unmount();
  });
});
