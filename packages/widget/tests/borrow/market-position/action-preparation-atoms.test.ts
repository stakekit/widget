import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, SubscriptionRef } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import { deriveBorrowPositions } from "../../../src/domain/borrow/positions/borrow-positions";
import { TokenBalancesResponse } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../../src/domain/wallet/wallet-scope";
import { borrowMarketPositionIntentEventProjectionAtom } from "../../../src/features/borrow/index";
import { getBorrowPositionActions } from "../../../src/features/borrow/market-position/model/details";
import {
  borrowRepayFormAtom,
  makeBorrowPositionActionRouteKey,
} from "../../../src/features/borrow/market-position/state/action-form";
import { tokenBalancesScanAtom } from "../../../src/features/portfolio/index";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom as borrowPositionsAtom,
} from "../../../src/resources/borrow-positions/borrow-positions";
import { BorrowResourceSource } from "../../../src/services/api/resource-sources";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../../src/services/events/widget-domain-events";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import {
  disconnectedLedgerConnectorState,
  type NormalizedWalletState,
  type WalletState,
} from "../../../src/services/wallet/wallet-state";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});

const integrationDto = {
  id: "aave-borrow",
  providerId: "aave",
  name: "Aave V3",
  networks: ["ethereum"],
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  actions: [],
} as const;

const marketDto = {
  id: "aave-v3-ethereum-usdc",
  integrationId: integrationDto.id,
  network: "ethereum",
  type: "pool",
  poolAddress: "0x0000000000000000000000000000000000000001",
  loanToken: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  collateralTokens: [
    {
      token: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
      },
      priceUsd: "2000",
      maxLtv: "0.8",
      liquidationThreshold: "0.85",
      liquidationPenalty: "0.05",
      supplyRate: "0.02",
    },
  ],
  borrowRate: "0.06",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  utilizationRate: "0.5",
  loanTokenPriceUsd: "1",
  isBorrowEnabled: true,
  supplyCollateralFeeBps: "0",
  feeWrapperAddress: null,
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  minLoan: null,
} as const;

const positionDto = {
  address,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: marketDto.id,
      pendingActions: [],
      tokenAddress: marketDto.loanToken.address,
      tokenSymbol: "USDC",
    },
  ],
  healthFactor: "2.125",
  integrationId: integrationDto.id,
  netApy: "-0.006",
  netWorthUsd: "600",
  network: "ethereum",
  supplyBalances: [],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "0",
  totalSuppliedUsd: "0",
} as const;

describe("Market Position action preparation atoms", () => {
  it.effect(
    "owns active position intent and derives Ready from current facts",
    () =>
      Effect.gen(function* () {
        const integration =
          Schema.decodeUnknownSync(Integration)(integrationDto);
        const market = Schema.decodeUnknownSync(Market)(marketDto);
        const accountSnapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
          {
            ...positionDto,
            debtBalances: [
              {
                ...positionDto.debtBalances[0],
                pendingActions: [
                  {
                    args: {
                      marketId: market.id,
                      tokenAddress: market.loanToken.address,
                    },
                    label: "Repay",
                    type: "repay",
                  },
                ],
              },
            ],
          }
        );
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
        const walletState = yield* SubscriptionRef.make({
          connection: connection(walletScope),
          ledger: disconnectedLedgerConnectorState,
        } satisfies WalletState);
        let currentAccountSnapshot = accountSnapshot;
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              appRuntime.layer,
              Layer.merge(
                Layer.succeed(BorrowResourceSource, {
                  getIntegrations: () => Effect.succeed([integration]),
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
                } as never),
                Layer.succeed(WidgetDomainEvents, domainEvents)
              ) as never
            ),
            Atom.initialValue(
              walletRuntime.layer,
              Layer.succeed(WalletService, {
                state: SubscriptionRef.get(walletState),
                states: SubscriptionRef.changes(walletState),
                wagmiConfig: {},
              } as never) as never
            ),
            applicationRuntimeInitInitialValue({
              apiKey: "api-key",
              borrowEnabled: true,
              dashboardVariant: true,
              variant: "default",
            }),
            Atom.initialValue(tokenBalancesScanAtom, {
              enabled: true,
              result: AsyncResult.success(
                Schema.decodeUnknownSync(TokenBalancesResponse)([
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
                ])
              ),
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

        const otherWalletScope = new WalletScopeKey({
          address: Schema.decodeSync(WalletAddress)(
            "0x0000000000000000000000000000000000000002"
          ),
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

        const refreshedAccountSnapshot = Schema.decodeUnknownSync(
          BorrowAccountSnapshot
        )({
          ...positionDto,
          debtBalances: [
            {
              ...positionDto.debtBalances[0],
              balance: "20",
              balanceRaw: "20000000",
              balanceUsd: "20",
              pendingActions: accountSnapshot.debtBalances[0]?.pendingActions,
            },
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
