import { Effect, Layer, Option, Schema, Stream, SubscriptionRef } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../../src/app/config/settings";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import { currentBorrowEntryAtom } from "../../../src/features/borrow/borrow-entry/state/borrow-entry";
import { borrowEntryTransactionFlowOutcomeBindingAtom } from "../../../src/features/borrow/borrow-entry/state/transaction-flow-outcomes";
import type { BorrowTransactionFlowOutcome } from "../../../src/features/borrow-transaction-flow/state";
import { BorrowTransactionFlowService } from "../../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { tokenBalancesScanAtom } from "../../../src/features/portfolio/state";
import { walletScopeAtom } from "../../../src/features/wallet/state";
import { BorrowResourceSource } from "../../../src/services/api/borrow-resource-source";
import { WalletScopeKey } from "../../../src/services/wallet/domain/scope";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

describe("Borrow Entry transaction-flow outcomes", () => {
  it("resets entry state only for a matching Done outcome", async () => {
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
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(BorrowResourceSource, {
            getIntegrations: () => Effect.succeed([]),
            getMarkets: () =>
              Effect.succeed({
                items: [],
                limit: 100,
                offset: 0,
                total: 0,
              }),
            getPositionData: () => Effect.succeed([]),
          } as never)
        ),
        Atom.initialValue(
          widgetConfigAtom,
          normalizeWidgetConfig({
            apiKey: "api-key",
            borrowEnabled: true,
            dashboardVariant: true,
            variant: "default",
          })
        ),
        Atom.initialValue(walletScopeAtom, walletScope),
        Atom.initialValue(tokenBalancesScanAtom, {
          enabled: true,
          result: AsyncResult.success([]),
        }),
      ],
    });
    const unmount = registry.mount(
      borrowEntryTransactionFlowOutcomeBindingAtom
    );

    registry.set(currentBorrowEntryAtom, {
      amount: "7",
      type: "borrowAmount/set",
    });

    await Effect.runPromise(
      SubscriptionRef.set(
        outcomes,
        Option.some({
          _tag: "ExecutionStarted",
          entry: { _tag: "BorrowEntry" },
          epoch: 1,
        })
      )
    );
    await Effect.runPromise(
      SubscriptionRef.set(
        outcomes,
        Option.some({
          _tag: "Done",
          entry: { _tag: "MarketPosition", marketId: "market-1" },
          epoch: 2,
        })
      )
    );
    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "7"
    );

    await Effect.runPromise(
      SubscriptionRef.set(
        outcomes,
        Option.some({
          _tag: "Done",
          entry: { _tag: "BorrowEntry" },
          epoch: 3,
        })
      )
    );
    await vi.waitFor(() =>
      expect(
        registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()
      ).toBe("0")
    );
    unmount();
    registry.dispose();
  });
});
