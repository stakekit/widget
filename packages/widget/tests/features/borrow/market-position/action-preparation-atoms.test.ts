import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, SubscriptionRef } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { appRuntime } from "../../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../../src/app/runtime/wallet-runtime";
import { deriveBorrowPositions } from "../../../../src/domain/borrow/positions/borrow-positions";
import { TokenBalancesResponse } from "../../../../src/domain/finance/models";
import { WalletAddress } from "../../../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../../../src/domain/wallet/wallet-scope";
import { borrowMarketPositionIntentEventProjectionAtom } from "../../../../src/features/borrow/index";
import { getBorrowPositionActions } from "../../../../src/features/borrow/market-position/model/details";
import {
  borrowRepayFormAtom,
  makeBorrowPositionActionRouteKey,
} from "../../../../src/features/borrow/market-position/state/action-form";
import { tokenBalancesScanAtom } from "../../../../src/features/portfolio/index";
import { walletScopeAtom } from "../../../../src/features/wallet/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom as borrowPositionsAtom,
} from "../../../../src/resources/borrow-positions/borrow-positions";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../../../src/services/events/widget-domain-events";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
  type WalletState,
} from "../../../../src/services/wallet/wallet-state";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegration,
  makeBorrowMarket,
} from "../../../fixtures/borrow";
import { borrowResourceSourceLayer } from "../../../utils/services/borrow-resource-source";
import { makeTestWallet } from "../../../utils/services/wallet-service";
import { applicationRuntimeInitInitialValue } from "../../../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});

describe("Market Position action preparation atoms", () => {
  it.effect(
    "owns active position intent and derives Ready from current facts",
    () =>
      Effect.gen(function* () {
        const integration = makeBorrowIntegration();
        const market = makeBorrowMarket();
        const repayPendingAction = {
          args: {
            marketId: market.id,
            tokenAddress: market.loanToken.address,
          },
          label: "Repay",
          type: "repay",
        };
        const accountSnapshot = makeBorrowAccountSnapshot({
          debtBalances: [
            makeBorrowDebtBalanceDto({ pendingActions: [repayPendingAction] }),
          ],
        });
        const position = deriveBorrowPositions({
          integrationAccountSnapshots: [{ accountSnapshot, integration }],
          markets: [market],
        }).items[0];
        if (!position) {
          throw new Error("Expected Borrow position");
        }
        const action = getBorrowPositionActions({
          position,
          t: ((key: string) => key) as never,
        }).find((candidate) => candidate.type === "repay");
        if (!action) {
          throw new Error("Expected repay action");
        }
        const events = yield* SubscriptionRef.make<WidgetDomainEvent>({
          _tag: "TransactionWorkflowEnded",
          owner: walletScopeOwnerKey(walletScope),
          workflowKind: "Borrow",
        });
        const domainEvents = WidgetDomainEvents.of({
          events: SubscriptionRef.changes(events),
          publish: () => Effect.void,
        });
        const connection = (
          scope: WalletScopeKey
        ): Extract<
          NormalizedWalletState,
          { readonly status: "connected" }
        > => ({
          additionalAddresses: scope.additionalAddresses,
          address: scope.address,
          chain: {} as never,
          connector: {} as never,
          connectorChains: [],
          isLedgerLive: false,
          isLedgerLiveAccountPlaceholder: false,
          ledgerAccounts: [],
          network: scope.network,
          status: "connected",
        });
        const walletState = yield* SubscriptionRef.make<WalletState>({
          connection: connection(walletScope),
          ledger: disconnectedLedgerConnectorState,
        });
        const wallet = yield* makeTestWallet({ state: walletState });
        let currentAccountSnapshot = accountSnapshot;
        const tokenBalances = yield* Schema.decodeEffect(TokenBalancesResponse)(
          [
            {
              amount: "1000",
              availableYields: [],
              token: {
                address: market.loanToken.address,
                decimals: market.loanToken.decimals,
                name: market.loanToken.name,
                network: market.network,
                symbol: market.loanToken.symbol,
              },
            },
          ]
        );
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              appRuntime.layer,
              Layer.merge(
                borrowResourceSourceLayer({
                  getIntegrations: Effect.succeed([integration]),
                  getMarkets: () =>
                    Effect.succeed({
                      items: [market],
                      limit: 100,
                      offset: 0,
                      total: 1,
                    }),
                  getPositionData: () =>
                    Effect.succeed([
                      { integration, position: currentAccountSnapshot },
                    ]),
                }),
                Layer.succeed(WidgetDomainEvents, domainEvents)
              )
            ),
            Atom.initialValue(walletRuntime.layer, wallet.layer as never),
            applicationRuntimeInitInitialValue({
              apiKey: "api-key",
              borrowEnabled: true,
              dashboardVariant: true,
              variant: "default",
            }),
            Atom.initialValue(tokenBalancesScanAtom, {
              enabled: true,
              result: AsyncResult.success(tokenBalances),
            }),
          ],
        });
        const unmountProjection = registry.mount(
          borrowMarketPositionIntentEventProjectionAtom
        );

        const formAtom = borrowRepayFormAtom(
          makeBorrowPositionActionRouteKey(action)
        );
        let releaseForm = registry.mount(formAtom);
        expect(registry.get(formAtom)?.preparation._tag).toBe("Idle");

        registry.set(formAtom, {
          amount: "25",
          type: "amount/set",
        });
        const view = registry.get(formAtom);

        expect(view?.preparation._tag).toBe("Ready");
        if (view?.preparation._tag === "Ready") {
          expect(view.preparation.review.command).toMatchObject({
            action: "repay",
            address,
            args: { amount: "25", marketId: market.id },
          });
          expect(view.preparation.review.summary).toMatchObject({
            action: "repay",
            borrowAmount: "25",
            riskStatus: "available",
          });
        }

        releaseForm();
        yield* Effect.promise(
          () => new Promise<void>((resolve) => setTimeout(resolve, 0))
        );
        releaseForm = registry.mount(formAtom);
        const reopened = registry.get(formAtom);
        expect(reopened).toMatchObject({
          preparation: { _tag: "Idle" },
        });
        expect(reopened?.amount.toString()).toBe("0");
        registry.set(formAtom, {
          amount: "25",
          type: "amount/set",
        });

        const otherAddress = yield* Schema.decodeEffect(WalletAddress)(
          "0x0000000000000000000000000000000000000002"
        );
        const otherWalletScope = new WalletScopeKey({
          address: otherAddress,
          network: walletScope.network,
        });
        yield* SubscriptionRef.set(walletState, {
          connection: connection(otherWalletScope),
          ledger: disconnectedLedgerConnectorState,
        });
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(walletScopeAtom)).toEqual(otherWalletScope)
          )
        );
        expect(registry.get(formAtom)?.amount.toString()).toBe("0");
        yield* SubscriptionRef.set(walletState, {
          connection: connection(walletScope),
          ledger: disconnectedLedgerConnectorState,
        });
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(walletScopeAtom)).toEqual(walletScope)
          )
        );
        expect(registry.get(formAtom)?.amount.toString()).toBe("0");
        registry.set(formAtom, {
          amount: "25",
          type: "amount/set",
        });

        const refreshedAccountSnapshot = makeBorrowAccountSnapshot({
          debtBalances: [
            makeBorrowDebtBalanceDto({
              balance: "20",
              balanceRaw: "20000000",
              balanceUsd: "20",
              pendingActions: [repayPendingAction],
            }),
          ],
          totalBorrowedUsd: "20",
        });
        currentAccountSnapshot = refreshedAccountSnapshot;
        registry.refresh(
          borrowPositionsAtom(new BorrowPositionsKey({ scope: walletScope }))
        );
        const refreshedView = registry.get(formAtom);
        expect(refreshedView?.preparation).toMatchObject({
          _tag: "Ready",
          warnings: ["AmountExceedsPositionBalance"],
        });
        yield* SubscriptionRef.set(events, {
          _tag: "TransactionWorkflowStarted",
          owner: walletScopeOwnerKey(walletScope),
        });
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(formAtom)?.amount.toString()).toBe("0")
          )
        );
        releaseForm();
        unmountProjection();
        registry.dispose();
      })
  );
});
