import { Effect, Layer, Option, Schema, Stream, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { MarketId } from "../../../src/domain/borrow/ids";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import { borrowActionFormAtom } from "../../../src/features/borrow/market-position/state/action";
import type { BorrowTransactionFlowOutcome } from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import { BorrowTransactionFlowService } from "../../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { WalletScopeKey } from "../../../src/services/wallet/domain/scope";

const marketId = Schema.decodeSync(MarketId)("market-1");
const otherMarketId = Schema.decodeSync(MarketId)("market-2");
const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const scope = new WalletScopeKey({ address, network: "base" });

describe("Borrow Transaction Flow outcome ownership", () => {
  it("resets a staged Market Position action only for its origin", async () => {
    const outcomes = await Effect.runPromise(
      SubscriptionRef.make<Option.Option<BorrowTransactionFlowOutcome>>(
        Option.none()
      )
    );
    const flow = BorrowTransactionFlowService.of({
      acquireSession: () => Effect.succeed({ _tag: "RejectedStale" } as const),
      currentSession: Stream.never,
      latestOutcome: SubscriptionRef.changes(outcomes),
      start: () => Effect.succeed({ _tag: "RejectedOwner" } as const),
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          walletRuntime.layer,
          Layer.succeed(BorrowTransactionFlowService, flow) as never
        ),
      ],
    });
    const unmount = registry.mount(borrowActionFormAtom);
    registry.set(borrowActionFormAtom, {
      actionId: "repay",
      marketId,
      network: "base",
      scope,
      type: "preparePositionAction",
    });

    await Effect.runPromise(
      SubscriptionRef.set(
        outcomes,
        Option.some({
          _tag: "Done",
          entry: { _tag: "MarketPosition", marketId: otherMarketId },
          epoch: 1,
        })
      )
    );
    expect(registry.get(borrowActionFormAtom).type).toBe("positionAction");

    unmount();
    await Effect.runPromise(
      SubscriptionRef.set(
        outcomes,
        Option.some({
          _tag: "ExecutionStarted",
          entry: { _tag: "MarketPosition", marketId },
          epoch: 2,
        })
      )
    );
    await Effect.runPromise(
      SubscriptionRef.set(
        outcomes,
        Option.some({
          _tag: "Done",
          entry: { _tag: "MarketPosition", marketId },
          epoch: 2,
        })
      )
    );
    const remount = registry.mount(borrowActionFormAtom);
    expect(registry.get(borrowActionFormAtom)).toEqual({ type: "idle" });
    remount();
    registry.dispose();
  });
});
