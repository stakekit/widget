import { Effect, Layer, Schema, SubscriptionRef } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../../src/app/config/settings";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { currentBorrowEntryAtom } from "../../../src/features/borrow/borrow-entry/state/borrow-entry";
import { borrowEntryIntentEventProjectionAtom } from "../../../src/features/borrow/state";
import { tokenBalancesScanAtom } from "../../../src/features/portfolio/state";
import { walletScopeAtom } from "../../../src/features/wallet/state";
import { BorrowResourceSource } from "../../../src/services/api/borrow-resource-source";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../../src/services/events/widget-domain-events";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../../src/services/wallet/wallet-scope";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000002"
  ),
  network: "ethereum",
});

describe("Borrow Entry transaction-workflow events", () => {
  it("consumes only matching active owner intent", async () => {
    const events = await Effect.runPromise(
      SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(otherWalletScope),
      })
    );
    const domainEvents = WidgetDomainEvents.of({
      events: SubscriptionRef.changes(events),
      publish: () => Effect.void,
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.merge(
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
            } as never),
            Layer.succeed(WidgetDomainEvents, domainEvents)
          ) as never
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
    const unmountProjection = registry.mount(
      borrowEntryIntentEventProjectionAtom
    );
    const unmount = registry.mount(currentBorrowEntryAtom);
    registry.set(currentBorrowEntryAtom, {
      amount: "7",
      type: "borrowAmount/set",
    });

    await Effect.runPromise(
      SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(otherWalletScope),
      })
    );
    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "7"
    );

    await Effect.runPromise(
      SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowEnded",
        owner: walletScopeOwnerKey(walletScope),
        workflowKind: "Borrow",
      })
    );
    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "7"
    );

    await Effect.runPromise(
      SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(walletScope),
      })
    );
    await vi.waitFor(() =>
      expect(
        registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()
      ).toBe("0")
    );
    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "0"
    );
    unmount();
    unmountProjection();
    registry.dispose();
  });
});
