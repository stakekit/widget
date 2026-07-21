import { Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import { borrowActionFormAtom } from "../../src/features/borrow/atoms/action-form";
import { borrowTransactionFlowOutcomeBindingAtom } from "../../src/features/borrow/atoms/transaction-flow-outcomes";
import type {
  BorrowTransactionFlowIntake,
  BorrowTransactionFlowReview,
} from "../../src/features/borrow-transaction-flow/state";
import { makeBorrowFlowSessionStore } from "../../src/features/borrow-transaction-flow/state/borrow-flow-session-store";
import { publishBorrowTransactionFlowOutcomeAtom } from "../../src/features/borrow-transaction-flow/state/outcomes";
import { currentWalletScopeAtom } from "../../src/features/wallet/state/selectors";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";

describe("borrow flow session state", () => {
  it("captures immutable, fresh sessions and ignores a stale clear", () => {
    const address = Schema.decodeSync(WalletAddress)(
      "0x0000000000000000000000000000000000000001"
    );
    const walletScope = new WalletScopeKey({ address, network: "base" });
    const registry = AtomRegistry.make({
      initialValues: [[currentWalletScopeAtom, walletScope]],
    });
    const store = makeBorrowFlowSessionStore();
    const summary = {
      action: "borrow",
      marketLabel: "USDC market",
      network: "base",
      providerName: "Provider",
    } as const;
    const intake = {
      entry: { _tag: "BorrowDashboard" },
      request: {
        action: "borrow",
        address,
        args: { marketId: "market-1" },
        integrationId: "provider-1",
      },
      summary,
    } as BorrowTransactionFlowIntake;

    registry.set(store.startAtom, intake);
    const first = registry.get(store.currentSessionAtom);
    registry.set(store.startAtom, intake);
    const second = registry.get(store.currentSessionAtom);

    expect(first?.epoch).toBe(1);
    expect(second?.epoch).toBe(2);
    expect(second?.intake).not.toBe(intake);
    expect(second?.walletScope).not.toBe(walletScope);

    registry.set(store.clearAtom, first?.epoch ?? 0);
    expect(registry.get(store.currentSessionAtom)?.epoch).toBe(2);
  });

  it("applies each flow outcome once to Borrow-owned form state", () => {
    const address = Schema.decodeSync(WalletAddress)(
      "0x0000000000000000000000000000000000000001"
    );
    const review = {
      request: {
        action: "borrow",
        address,
        args: { marketId: "market-1" },
        integrationId: "provider-1",
      },
      summary: {
        action: "borrow",
        marketLabel: "USDC market",
        network: "base",
        providerName: "Provider",
      },
    } as BorrowTransactionFlowReview;
    const registry = AtomRegistry.make();
    const unmount = registry.mount(borrowTransactionFlowOutcomeBindingAtom);

    registry.set(borrowActionFormAtom, {
      type: "prepareReview",
      reviewState: review,
    });
    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "ExecutionStarted",
      epoch: 1,
    });
    expect(registry.get(borrowActionFormAtom).type).toBe("idle");

    registry.set(borrowActionFormAtom, {
      type: "prepareReview",
      reviewState: review,
    });
    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "ExecutionStarted",
      epoch: 1,
    });
    expect(registry.get(borrowActionFormAtom).type).toBe("review");

    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "Done",
      epoch: 1,
    });
    expect(registry.get(borrowActionFormAtom).type).toBe("idle");
    unmount();
  });
});
