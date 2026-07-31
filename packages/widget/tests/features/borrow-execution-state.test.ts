import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import type { BorrowTransactionFlowIntake } from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  borrowTransactionFlowOutcomeAtom,
  startBorrowTransactionFlowAtom,
} from "../../src/features/borrow-transaction-flow/state";
import {
  borrowFlowSessionStore,
  makeBorrowFlowSessionStore,
} from "../../src/features/borrow-transaction-flow/state/borrow-flow-session-store";
import { publishBorrowTransactionFlowOutcomeAtom } from "../../src/features/borrow-transaction-flow/state/outcomes";
import { walletScopeAtom } from "../../src/features/wallet/state";
import {
  makeWidgetNavigation,
  toWidgetPath,
  WidgetNavigation,
} from "../../src/services/navigation/widget-navigation";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({ address, network: "base" });
const intake = {
  command: {
    action: "borrow",
    address,
    args: { marketId: "market-1" },
    integrationId: "provider-1",
  },
  entry: { _tag: "BorrowEntry" },
  summary: {
    action: "borrow",
    borrowAmount: "1",
    existingCollateralUsd: "100",
    existingDebtUsd: "0",
    loanTokenSymbol: "USDC",
    marketLabel: "USDC market",
    network: "base",
    projectedCollateralUsd: "100",
    projectedDebtUsd: "1",
    providerName: "Provider",
    riskStatus: "unavailable",
  },
} as BorrowTransactionFlowIntake;

const widgetConfig = normalizeWidgetConfig({
  apiKey: "api-key",
  borrowEnabled: true,
  dashboardVariant: true,
  variant: "default",
});

describe("borrow flow session state", () => {
  it("publishes the immutable origin with flow outcomes", () => {
    const registry = AtomRegistry.make();
    const entry = {
      _tag: "MarketPosition" as const,
      marketId: "market-1",
    };

    registry.set(publishBorrowTransactionFlowOutcomeAtom, {
      _tag: "Done",
      entry,
      epoch: 3,
    });

    expect(
      Option.getOrThrow(registry.get(borrowTransactionFlowOutcomeAtom))
    ).toEqual({
      _tag: "Done",
      entry,
      epoch: 3,
    });
  });

  it("captures immutable, fresh sessions and ignores a stale clear", () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [widgetConfigAtom, widgetConfig],
        [walletScopeAtom, walletScope],
      ],
    });
    const store = makeBorrowFlowSessionStore();

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

  it("captures intake and performs requested navigation as one Start command", async () => {
    const push = vi.fn(() => Effect.void);
    const registry = AtomRegistry.make({
      initialValues: [
        [widgetConfigAtom, widgetConfig],
        [walletScopeAtom, walletScope],
        [
          appRuntime.layer,
          Layer.succeed(
            WidgetNavigation,
            makeWidgetNavigation({
              back: () => Effect.void,
              push,
              replace: () => Effect.void,
            })
          ),
        ],
      ],
    });
    const reviewPath = toWidgetPath("/borrow/review");

    registry.set(startBorrowTransactionFlowAtom, {
      intake,
      navigation: { _tag: "Push", path: reviewPath },
    });

    await expect
      .poll(() =>
        registry
          .get(startBorrowTransactionFlowAtom)
          .pipe(AsyncResult.value, Option.getOrNull)
      )
      .toMatchObject({ _tag: "Started" });
    expect(push).toHaveBeenCalledWith(reviewPath, {
      _tag: "Push",
      path: reviewPath,
    });
    expect(
      registry.get(borrowFlowSessionStore.currentSessionAtom)?.intake.command
    ).toEqual(intake.command);
    registry.dispose();
  });

  it("rolls back a session when Start navigation fails", async () => {
    const registry = AtomRegistry.make({
      initialValues: [
        [widgetConfigAtom, widgetConfig],
        [walletScopeAtom, walletScope],
        [
          appRuntime.layer,
          Layer.succeed(
            WidgetNavigation,
            makeWidgetNavigation({
              back: () => Effect.void,
              push: () => Effect.fail({ _tag: "NavigationFailed" } as never),
              replace: () => Effect.void,
            })
          ),
        ],
      ],
    });

    registry.set(startBorrowTransactionFlowAtom, {
      intake,
      navigation: { _tag: "Push", path: toWidgetPath("/borrow/review") },
    });

    await expect
      .poll(() =>
        AsyncResult.isFailure(registry.get(startBorrowTransactionFlowAtom))
      )
      .toBe(true);
    expect(registry.get(borrowFlowSessionStore.currentSessionAtom)).toBeNull();
    registry.dispose();
  });
});
