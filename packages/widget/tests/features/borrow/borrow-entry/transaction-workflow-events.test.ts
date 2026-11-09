import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, SubscriptionRef } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { appRuntime } from "../../../../src/app/runtime/app-runtime";
import type { Market } from "../../../../src/domain/borrow/catalog/market";
import { decodeTokenId } from "../../../../src/domain/borrow/ids";
import { WalletAddress } from "../../../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../../../src/domain/wallet/wallet-scope";
import { currentBorrowEntryAtom } from "../../../../src/features/borrow/borrow-entry/state/borrow-entry";
import { borrowEntryIntentEventProjectionAtom } from "../../../../src/features/borrow/index";
import { tokenBalancesScanAtom } from "../../../../src/features/portfolio/index";
import { walletScopeAtom } from "../../../../src/features/wallet/index";
import { BorrowResourceSource } from "../../../../src/services/api/resource-sources";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../../../src/services/events/widget-domain-events";
import {
  borrowWalletAddress,
  makeBorrowCollateralTokenDto,
  makeBorrowMarket,
} from "../../../fixtures/borrow";
import { applicationRuntimeInitInitialValue } from "../../../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const otherWalletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000002"
  ),
  network: "ethereum",
});

const makeMarket = ({
  collateralAddress,
  collateralSymbol,
  id,
}: {
  readonly collateralAddress: string;
  readonly collateralSymbol: string;
  readonly id: string;
}) =>
  makeBorrowMarket({
    collateralTokens: [
      makeBorrowCollateralTokenDto({
        priceUsd: "1",
        token: {
          address: collateralAddress,
          decimals: 18,
          name: collateralSymbol,
          symbol: collateralSymbol,
        },
      }),
    ],
    id,
  });

const makeEntryRegistry = ({
  events,
  markets,
}: {
  readonly events: SubscriptionRef.SubscriptionRef<WidgetDomainEvent>;
  readonly markets: ReadonlyArray<Market>;
}) => {
  const domainEvents = WidgetDomainEvents.of({
    events: SubscriptionRef.changes(events),
    publish: () => Effect.void,
  });

  return AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.merge(
          Layer.succeed(BorrowResourceSource, {
            getIntegrations: Effect.succeed([]),
            getMarkets: () =>
              Effect.succeed({
                items: markets,
                limit: 100,
                offset: 0,
                total: markets.length,
              }),
            getPositionData: () => Effect.succeed([]),
          } as never),
          Layer.succeed(WidgetDomainEvents, domainEvents)
        ) as never
      ),
      applicationRuntimeInitInitialValue({
        apiKey: "api-key",
        borrowEnabled: true,
        dashboardVariant: true,
        variant: "default",
      }),
      Atom.initialValue(walletScopeAtom, walletScope),
      Atom.initialValue(tokenBalancesScanAtom, {
        enabled: true,
        result: AsyncResult.success([]),
      }),
    ],
  });
};

describe("Borrow Entry transaction-workflow events", () => {
  it.effect("consumes only matching active owner intent", () =>
    Effect.gen(function* () {
      const events = yield* SubscriptionRef.make<WidgetDomainEvent>({
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(otherWalletScope),
      });
      const registry = makeEntryRegistry({ events, markets: [] });
      const unmountProjection = registry.mount(
        borrowEntryIntentEventProjectionAtom
      );
      const unmount = registry.mount(currentBorrowEntryAtom);
      registry.set(currentBorrowEntryAtom, {
        amount: "7",
        type: "borrowAmount/set",
      });

      yield* SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(otherWalletScope),
      });
      expect(
        registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()
      ).toBe("7");

      yield* SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowEnded",
        owner: walletScopeOwnerKey(walletScope),
        workflowKind: "Borrow",
      });
      expect(
        registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()
      ).toBe("7");

      yield* SubscriptionRef.set(events, {
        _tag: "TransactionWorkflowStarted",
        owner: walletScopeOwnerKey(walletScope),
      });
      yield* Effect.promise(() =>
        vi.waitFor(() =>
          expect(
            registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()
          ).toBe("0")
        )
      );
      expect(
        registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()
      ).toBe("0");
      unmount();
      unmountProjection();
      registry.dispose();
    })
  );

  it.effect(
    "keeps the started market and collateral selected while clearing amounts",
    () =>
      Effect.gen(function* () {
        const defaultMarket = makeMarket({
          collateralAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
          collateralSymbol: "WETH",
          id: "aave-v3-ethereum-weth",
        });
        const startedMarket = makeMarket({
          collateralAddress: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
          collateralSymbol: "WBTC",
          id: "morpho-blue-ethereum-wbtc",
        });
        const startedCollateralTokenId = decodeTokenId(
          startedMarket.collateralTokens[0]!.token
        );
        const events = yield* SubscriptionRef.make<WidgetDomainEvent>({
          _tag: "TransactionWorkflowEnded",
          owner: walletScopeOwnerKey(walletScope),
          workflowKind: "Borrow",
        });
        const registry = makeEntryRegistry({
          events,
          markets: [defaultMarket, startedMarket],
        });
        const unmountProjection = registry.mount(
          borrowEntryIntentEventProjectionAtom
        );
        const unmount = registry.mount(currentBorrowEntryAtom);
        registry.set(currentBorrowEntryAtom, {
          marketId: startedMarket.id,
          type: "market/select",
        });
        registry.set(currentBorrowEntryAtom, {
          amount: "7",
          type: "borrowAmount/set",
        });
        registry.set(currentBorrowEntryAtom, {
          amount: "2",
          type: "collateralAmount/set",
        });

        yield* SubscriptionRef.set(events, {
          _tag: "TransactionWorkflowStarted",
          owner: walletScopeOwnerKey(walletScope),
        });
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(
              registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()
            ).toBe("0")
          )
        );

        const view = registry.get(currentBorrowEntryAtom);
        expect(view?.selectedMarketId).toBe(startedMarket.id);
        expect(view?.selectedCollateralTokenId).toBe(startedCollateralTokenId);
        expect(view?.collateralAmount.toString()).toBe("0");
        unmount();
        unmountProjection();
        registry.dispose();
      })
  );
});
