import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../../src/app/config/settings";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import { currentBorrowEntryAtom } from "../../../src/features/borrow/borrow-entry/state/borrow-entry";
import { borrowEntryTransactionFlowOutcomeBindingAtom } from "../../../src/features/borrow/borrow-entry/state/transaction-flow-outcomes";
import { publishBorrowTransactionFlowOutcomeAtom } from "../../../src/features/borrow-transaction-flow/state/outcomes";
import { tokenBalancesScanAtom } from "../../../src/features/portfolio/state";
import { walletScopeAtom } from "../../../src/features/wallet/state";
import { BorrowResourceSource } from "../../../src/services/api/borrow-resource-source";
import { WalletScopeKey } from "../../../src/services/wallet/domain/scope";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});

describe("Borrow Entry transaction-flow outcomes", () => {
  it("resets entry state only for a matching Done outcome", () => {
    const registry = AtomRegistry.make({
      initialValues: [
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
    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "7"
    );

    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "ExecutionStarted",
      entry: { _tag: "BorrowEntry" },
      epoch: 1,
    });
    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "Done",
      entry: { _tag: "MarketPosition", marketId: "market-1" },
      epoch: 2,
    });

    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "7"
    );

    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "Done",
      entry: { _tag: "BorrowEntry" },
      epoch: 3,
    });

    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "0"
    );
    unmount();
  });
});
