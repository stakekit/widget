import { describe, expect, it, vi } from "@effect/vitest";
import BigNumber from "bignumber.js";
import { Cause, Effect, Layer, Option, Schema, SubscriptionRef } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";

import { deriveBorrowPositions } from "../../../../src/domain/borrow/borrow-positions";
import { decodeTokenId, MarketId } from "../../../../src/domain/borrow/ids";
import type { Market } from "../../../../src/domain/borrow/market";
import { exactDecimal } from "../../../../src/domain/finance/exact";
import { TokenBalancesResponse } from "../../../../src/domain/finance/models";
import { WalletAddress } from "../../../../src/domain/identity/identifiers";
import {
  WalletScopeKey,
  walletScopeOwnerKey,
} from "../../../../src/domain/wallet/wallet-scope";
import {
  applyBorrowFormAction,
  BorrowEntryKey,
  type BorrowFormIntent,
  resolveBorrowEntryView,
  shouldResetBorrowFormForCatalog,
} from "../../../../src/features/borrow/borrow-entry/model/borrow-entry";
import { currentBorrowEntryAtom } from "../../../../src/features/borrow/borrow-entry/state/borrow-entry";
import { borrowFlowDetailsAtom } from "../../../../src/features/borrow/borrow-entry/state/flow-details";
import { borrowEntryIntentEventProjectionAtom } from "../../../../src/features/borrow/borrow-entry/state/intent-projection";
import { tokenBalancesScanAtom } from "../../../../src/features/portfolio/index";
import { walletScopeAtom } from "../../../../src/features/wallet/index";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom as borrowMarketsAtom,
} from "../../../../src/resources/borrow-markets/borrow-markets";
import { appRuntime } from "../../../../src/runtime/app-runtime";
import { walletRuntime } from "../../../../src/runtime/wallet-runtime";
import { widgetConfigAtom } from "../../../../src/runtime/widget-config";
import { BorrowResourceSource } from "../../../../src/services/api/resource-sources";
import {
  type WidgetDomainEvent,
  WidgetDomainEvents,
} from "../../../../src/services/events/widget-domain-events";
import {
  disconnectedLedgerConnectorState,
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
  type WalletState,
} from "../../../../src/services/wallet/wallet-state";
import {
  borrowWalletAddress,
  makeBorrowAccountSnapshot,
  makeBorrowCollateralTokenDto,
  makeBorrowDebtBalanceDto,
  makeBorrowIntegration,
  makeBorrowMarket,
  makeBorrowSupplyBalanceDto,
  wethTokenAddress,
} from "../../../fixtures/borrow";
import {
  borrowEntryFlowDetails,
  borrowEntryFlowMarket,
} from "../../../utils/borrow-flow-entry";
import { makeTestWallet } from "../../../utils/services/wallet-service";
import { applicationRuntimeInitInitialValue } from "../../../utils/widget-config";

const address = Schema.decodeSync(WalletAddress)(borrowWalletAddress);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});

describe("Borrow Entry atoms", () => {
  it("keeps a non-first native collateral token explicitly selected", () => {
    const nativeCollateral = makeBorrowCollateralTokenDto({
      token: {
        decimals: 18,
        name: "Ether",
        symbol: "ETH",
      },
    });
    const market = makeBorrowMarket({
      collateralTokens: [makeBorrowCollateralTokenDto(), nativeCollateral],
    });
    const nativeToken = market.collateralTokens[1]!;
    const nativeTokenId = decodeTokenId(nativeToken.token);
    const intent = applyBorrowFormAction({
      action: {
        tokenId: nativeTokenId,
        type: "collateralToken/select",
      },
      intent: {
        borrowAmount: "0",
        collateralAmount: "1",
        selectedCollateralTokenId: null,
        selectedMarketId: market.id,
      },
    });
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: { ...intent, collateralAmount: "1" },
      key: new BorrowEntryKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      tokenBalances: Schema.decodeSync(TokenBalancesResponse)([
        {
          amount: "3",
          availableYields: [],
          token: {
            decimals: 18,
            name: "Ether",
            network: "ethereum",
            symbol: "ETH",
          },
        },
      ]),
    });

    expect(view.selectedCollateralTokenId).toBe(nativeTokenId);
    expect(view.selectedCollateralToken?.token.symbol).toBe("ETH");
    expect(view.selectedCollateralBalance?.amount).toBe("3");
    expect(view.projection.collateralMaxAmount.toString(10)).toBe("3");
    expect(view.preparation).toMatchObject({
      _tag: "Ready",
      review: {
        command: {
          action: "supply",
          args: { amount: "1", marketId: market.id },
        },
        summary: { collateralTokenSymbol: "ETH" },
      },
    });
    expect(
      view.preparation?._tag === "Ready"
        ? view.preparation.review.command.args.collateralTokenAddress
        : undefined
    ).toBeUndefined();
  });

  it("reduces form intent and prepares borrow review state in the atom view", () => {
    const market = makeBorrowMarket();
    const integration = makeBorrowIntegration();
    const selectedIntent = applyBorrowFormAction({
      action: {
        marketId: market.id,
        type: "market/select",
      },
      intent: {
        borrowAmount: "1",
        collateralAmount: "2",
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: null,
      } satisfies BorrowFormIntent,
    });
    const intent = applyBorrowFormAction({
      action: {
        amount: "1",
        type: "collateralAmount/set",
      },
      intent: applyBorrowFormAction({
        action: {
          amount: "25",
          type: "borrowAmount/set",
        },
        intent: selectedIntent,
      }),
    });
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([integration]),
      intent,
      key: new BorrowEntryKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      tokenBalances: Schema.decodeSync(TokenBalancesResponse)([
        {
          amount: "2",
          availableYields: [],
          token: {
            address: wethTokenAddress,
            decimals: 18,
            name: "Wrapped Ether",
            network: "ethereum",
            symbol: "WETH",
          },
        },
      ]),
    });

    expect(selectedIntent.collateralAmount).toBe("0");
    expect(view.isActionReady).toBe(true);
    expect(view.preparation?._tag).toBe("Ready");
    if (view.preparation?._tag !== "Ready") {
      throw new Error("Expected ready Borrow action preparation");
    }
    expect(view.preparation.review.command).toMatchObject({
      action: "borrow",
      address,
      args: {
        amount: "25",
        collateralAmount: "1",
        marketId: market.id,
      },
    });
  });

  it("blocks borrow review when authoritative positions are unavailable", () => {
    const market = makeBorrowMarket();
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "1",
        collateralAmount: "0",
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({ network: "ethereum", scope: walletScope }),
      marketsResult: AsyncResult.success([market]),
      positionsResult: AsyncResult.failure(Cause.fail(undefined as never)),
      tokenBalances: [],
    });

    expect(view.preparation).toBeNull();
    expect(view.isActionReady).toBe(false);
  });

  it("blocks collateral review when wallet balances are unavailable", () => {
    const market = makeBorrowMarket();
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "0",
        collateralAmount: "1",
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({ network: "ethereum", scope: walletScope }),
      marketsResult: AsyncResult.success([market]),
      tokenBalances: [],
      tokenBalancesAvailable: false,
    });

    expect(view.preparation).toBeNull();
    expect(view.isActionReady).toBe(false);
  });

  it("keeps retained markets visible but blocks review after refresh failure", () => {
    const market = makeBorrowMarket();
    const previousMarkets = AsyncResult.success([market]);
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "0",
        collateralAmount: "1",
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({ network: "ethereum", scope: walletScope }),
      marketsResult: AsyncResult.failure(Cause.fail(undefined as never), {
        previousSuccess: Option.some(previousMarkets),
      }),
      tokenBalances: Schema.decodeSync(TokenBalancesResponse)([
        {
          amount: "2",
          availableYields: [],
          token: {
            address: wethTokenAddress,
            decimals: 18,
            name: "Wrapped Ether",
            network: "ethereum",
            symbol: "WETH",
          },
        },
      ]),
    });

    expect(view.selectedMarket?.id).toBe(market.id);
    expect(view.preparation?._tag).toBe("Ready");
    expect(view.isActionReady).toBe(false);
    expect(view.marketsView).toMatchObject({
      _tag: "Ready",
      refreshFailure: Option.some(expect.anything()),
      value: [market],
    });
  });

  it("defaults the form to the first market where borrowing is enabled", () => {
    const disabledMarket = makeBorrowMarket({
      id: "disabled-market",
      isBorrowEnabled: false,
    });
    const enabledMarket = makeBorrowMarket({
      id: "enabled-market",
    });

    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "0",
        collateralAmount: "0",
        selectedCollateralTokenId: null,
        selectedMarketId: null,
      },
      key: new BorrowEntryKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([disabledMarket, enabledMarket]),
      tokenBalances: [],
    });

    expect(view.selectedMarketId).toBe(enabledMarket.id);
    expect(view.markets.map((market) => market.id)).toEqual([enabledMarket.id]);
  });

  const resolveWethCollateralView = ({
    borrowAmount,
    collateralAmount,
    market,
  }: {
    readonly borrowAmount: string;
    readonly collateralAmount: string;
    readonly market: Market;
  }) =>
    resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount,
        collateralAmount,
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      tokenBalances: Schema.decodeSync(TokenBalancesResponse)([
        {
          amount: "2",
          availableYields: [],
          token: {
            address: wethTokenAddress,
            decimals: 18,
            name: "Wrapped Ether",
            network: "ethereum",
            symbol: "WETH",
          },
        },
      ]),
    });

  it.each([
    { borrowAmount: "5", expectedWarning: false, minLoan: null },
    { borrowAmount: "5", expectedWarning: false, minLoan: "0" },
    { borrowAmount: "10", expectedWarning: false, minLoan: "10" },
    { borrowAmount: "9.99", expectedWarning: true, minLoan: "10" },
    { borrowAmount: "10.01", expectedWarning: false, minLoan: "10" },
  ])(
    "warns on the projected debt floor for minLoan=$minLoan and borrowAmount=$borrowAmount",
    ({ borrowAmount, expectedWarning, minLoan }) => {
      const view = resolveWethCollateralView({
        borrowAmount,
        collateralAmount: "1",
        market: makeBorrowMarket({ minLoan }),
      });

      expect(view.isActionReady).toBe(true);
      expect(view.validation.projectedDebtBelowMinimum).toBe(expectedWarning);
      expect(view.preparation?._tag).toBe("Ready");
    }
  );

  it("resets persisted form intent when a successful refresh removes the selected market", () => {
    const selectedMarket = makeBorrowMarket();
    const replacementMarket = makeBorrowMarket({
      id: "replacement-market",
    });
    const integration = makeBorrowIntegration();
    let catalog = [selectedMarket];
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(BorrowResourceSource, {
            getIntegrations: Effect.succeed([integration]),
            getMarkets: () =>
              Effect.succeed({
                items: catalog,
                limit: 100,
                offset: 0,
                total: catalog.length,
              }),
            getPositionData: () => Effect.succeed([]),
          } as never)
        ),
        Atom.initialValue(walletScopeAtom, walletScope),
        applicationRuntimeInitInitialValue({
          apiKey: "api-key",
          borrowEnabled: true,
          dashboardVariant: true,
          variant: "default",
        }),
        Atom.initialValue(tokenBalancesScanAtom, {
          enabled: true,
          result: AsyncResult.success([]),
        }),
      ],
    });

    expect(registry.get(currentBorrowEntryAtom)?.selectedMarketId).toBe(
      selectedMarket.id
    );
    registry.set(currentBorrowEntryAtom, {
      amount: "25",
      type: "borrowAmount/set",
    });
    registry.set(currentBorrowEntryAtom, {
      amount: "1",
      type: "collateralAmount/set",
    });

    catalog = [replacementMarket];
    registry.refresh(
      borrowMarketsAtom.foreground(
        new BorrowMarketsKey({ network: "ethereum", scope: "all" })
      )
    );

    const view = registry.get(currentBorrowEntryAtom);

    expect(view?.selectedMarketId).toBe(replacementMarket.id);
    expect(view?.borrowAmount.toString(10)).toBe("0");
    expect(view?.collateralAmount.toString(10)).toBe("0");
    expect(view?.catalogResetNotice).toBe(true);
  });

  it.each([
    { configured: undefined, expected: "all" },
    { configured: "enabled", expected: "enabled" },
    { configured: "all", expected: "all" },
  ] as const)(
    "lists the $expected market catalog when the host sets borrowMarketsScope to $configured",
    ({ configured, expected }) => {
      const enabledMarket = makeBorrowMarket();
      const otherMarket = makeBorrowMarket({
        id: "project-disabled-market",
      });
      const catalogs = {
        all: [enabledMarket, otherMarket],
        enabled: [enabledMarket],
      };
      const registry = AtomRegistry.make({
        initialValues: [
          Atom.initialValue(
            appRuntime.layer,
            Layer.succeed(BorrowResourceSource, {
              getIntegrations: Effect.succeed([]),
              getMarkets: (request: { readonly scope: "all" | "enabled" }) =>
                Effect.succeed({
                  items: catalogs[request.scope],
                  limit: 100,
                  offset: 0,
                  total: catalogs[request.scope].length,
                }),
              getPositionData: () => Effect.succeed([]),
            } as never)
          ),
          Atom.initialValue(walletScopeAtom, walletScope),
          applicationRuntimeInitInitialValue({
            apiKey: "api-key",
            borrowEnabled: true,
            ...(configured === undefined
              ? {}
              : { borrowMarketsScope: configured }),
            dashboardVariant: true,
            variant: "default",
          }),
          Atom.initialValue(tokenBalancesScanAtom, {
            enabled: true,
            result: AsyncResult.success([]),
          }),
        ],
      });

      expect(
        registry.get(currentBorrowEntryAtom)?.markets.map(({ id }) => id)
      ).toEqual(catalogs[expected].map(({ id }) => id));
    }
  );

  it("discards Entry Intent when its entry surface is released", async () => {
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(BorrowResourceSource, {
            getIntegrations: Effect.succeed([]),
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
        Atom.initialValue(walletScopeAtom, walletScope),
        applicationRuntimeInitInitialValue({
          apiKey: "api-key",
          borrowEnabled: true,
          dashboardVariant: true,
          variant: "default",
        }),
        Atom.initialValue(tokenBalancesScanAtom, {
          enabled: true,
          result: AsyncResult.success([]),
        }),
      ],
    });
    const unmountWalletScope = registry.mount(walletScopeAtom);
    const unmount = registry.mount(currentBorrowEntryAtom);
    registry.set(currentBorrowEntryAtom, {
      amount: "7",
      type: "borrowAmount/set",
    });
    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "7"
    );

    unmount();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const remount = registry.mount(currentBorrowEntryAtom);
    expect(registry.get(currentBorrowEntryAtom)?.borrowAmount.toString()).toBe(
      "0"
    );

    remount();
    unmountWalletScope();
    registry.dispose();
  });

  it.effect(
    "preserves form intent when Wallet Scope enrichment keeps the same owner",
    () =>
      Effect.gen(function* () {
        const selectedMarket = makeBorrowMarket();
        const integration = makeBorrowIntegration();
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
        const initialState = {
          connection: connection(walletScope),
          ledger: disconnectedLedgerConnectorState,
        } satisfies WalletState;
        const walletState =
          yield* SubscriptionRef.make<WalletState>(initialState);
        const wallet = yield* makeTestWallet({ state: walletState });
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              appRuntime.layer,
              Layer.succeed(BorrowResourceSource, {
                getIntegrations: Effect.succeed([integration]),
                getMarkets: () =>
                  Effect.succeed({
                    items: [selectedMarket],
                    limit: 100,
                    offset: 0,
                    total: 1,
                  }),
                getPositionData: () => Effect.succeed([]),
              } as never)
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
              result: AsyncResult.success([]),
            }),
          ],
        });
        const unmount = registry.mount(currentBorrowEntryAtom);

        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(currentBorrowEntryAtom)?.selectedMarketId).toBe(
              selectedMarket.id
            )
          )
        );
        registry.set(currentBorrowEntryAtom, {
          amount: "25",
          type: "borrowAmount/set",
        });
        registry.set(currentBorrowEntryAtom, {
          amount: "1",
          type: "collateralAmount/set",
        });

        const enrichedAddress = yield* Schema.decodeEffect(WalletAddress)(
          address.toUpperCase()
        );
        const enrichedScope = new WalletScopeKey({
          additionalAddresses: { cosmosPubKey: "cosmos-public-key" },
          address: enrichedAddress,
          network: walletScope.network,
        });
        yield* SubscriptionRef.set(walletState, {
          connection: connection(enrichedScope),
          ledger: disconnectedLedgerConnectorState,
        });

        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(walletScopeAtom)).toEqual(enrichedScope)
          )
        );
        expect(
          registry.get(currentBorrowEntryAtom)?.borrowAmount.toString(10)
        ).toBe("25");
        expect(
          registry.get(currentBorrowEntryAtom)?.collateralAmount.toString(10)
        ).toBe("1");

        const otherAddress = yield* Schema.decodeEffect(WalletAddress)(
          "0x0000000000000000000000000000000000000002"
        );
        const otherScope = new WalletScopeKey({
          address: otherAddress,
          network: walletScope.network,
        });
        yield* SubscriptionRef.set(walletState, {
          connection: connection(otherScope),
          ledger: disconnectedLedgerConnectorState,
        });
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(walletScopeAtom)).toEqual(otherScope)
          )
        );
        yield* SubscriptionRef.set(walletState, {
          connection: connection(enrichedScope),
          ledger: disconnectedLedgerConnectorState,
        });
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(walletScopeAtom)).toEqual(enrichedScope)
          )
        );
        expect(
          registry.get(currentBorrowEntryAtom)?.borrowAmount.toString(10)
        ).toBe("0");
        expect(
          registry.get(currentBorrowEntryAtom)?.collateralAmount.toString(10)
        ).toBe("0");

        registry.set(currentBorrowEntryAtom, {
          amount: "9",
          type: "borrowAmount/set",
        });
        yield* SubscriptionRef.set(walletState, {
          connection: disconnectedNormalizedWalletState,
          ledger: disconnectedLedgerConnectorState,
        });
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(registry.get(walletScopeAtom)).toBeNull())
        );
        yield* SubscriptionRef.set(walletState, {
          connection: connection(enrichedScope),
          ledger: disconnectedLedgerConnectorState,
        });
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(walletScopeAtom)).toEqual(enrichedScope)
          )
        );
        expect(
          registry.get(currentBorrowEntryAtom)?.borrowAmount.toString(10)
        ).toBe("0");

        unmount();
        registry.dispose();
      })
  );

  it("uses stable catalog identities when deciding whether to reset the form", () => {
    const selectedMarket = makeBorrowMarket();
    const otherMarket = makeBorrowMarket({
      id: "other-market",
    });
    const intent: BorrowFormIntent = {
      borrowAmount: "25",
      collateralAmount: "1",
      selectedCollateralTokenId: decodeTokenId(
        selectedMarket.collateralTokens[0]!.token
      ),
      selectedMarketId: selectedMarket.id,
    };

    expect(
      shouldResetBorrowFormForCatalog({
        intent,
        markets: [otherMarket, makeBorrowMarket()],
      })
    ).toBe(false);
    expect(
      shouldResetBorrowFormForCatalog({
        intent,
        markets: [otherMarket],
      })
    ).toBe(true);
    expect(
      shouldResetBorrowFormForCatalog({
        intent,
        markets: [
          makeBorrowMarket({
            isBorrowEnabled: false,
          }),
        ],
      })
    ).toBe(true);
    expect(
      shouldResetBorrowFormForCatalog({
        intent,
        markets: [
          makeBorrowMarket({
            collateralTokens: [],
          }),
        ],
      })
    ).toBe(true);
  });

  it("projects borrow form risk from existing selected-market positions", () => {
    const market = makeBorrowMarket();
    const integration = makeBorrowIntegration();
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: makeBorrowAccountSnapshot({
            supplyBalances: [
              makeBorrowSupplyBalanceDto({ marketId: market.id }),
            ],
            totalCollateralUsd: "1000",
            totalSuppliedUsd: "1000",
          }),
        },
      ],
      markets: [market],
    });
    const [position] = positions.items;

    if (!position) {
      throw new Error("Expected borrow position");
    }

    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "500",
        collateralAmount: "0",
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      positionsResult: AsyncResult.success(positions),
      tokenBalances: [],
    });

    expect(view.projection.existingCollateralUsd.toString(10)).toBe("1000");
    expect(view.projection.existingDebtUsd.toString(10)).toBe("400");
    expect(view.projection.projectedCollateralUsd.toString(10)).toBe("1000");
    expect(view.projection.projectedDebtUsd.toString(10)).toBe("900");
    expect(view.projection.projectedLtv).toEqual(new BigNumber("0.9"));
    // $850 of liquidation capacity behind $900 of debt: health factor 0.94.
    expect(view.validation.riskBlock).toBe("healthFactor");
  });

  it("validates borrow-only intent against the complete collateral composition", () => {
    const strictToken = makeBorrowCollateralTokenDto({
      liquidationThreshold: "0.6",
      maxLtv: "0.5",
    });
    const defaultToken = makeBorrowCollateralTokenDto({
      liquidationThreshold: "0.9",
      maxLtv: "0.8",
      token: {
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        decimals: 8,
        name: "Wrapped BTC",
        symbol: "WBTC",
      },
    });
    const market = makeBorrowMarket({
      collateralTokens: [defaultToken, strictToken],
    });
    const integration = makeBorrowIntegration();
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: makeBorrowAccountSnapshot({
            debtBalances: [
              makeBorrowDebtBalanceDto({ balance: "400", balanceUsd: "400" }),
            ],
            supplyBalances: [
              makeBorrowSupplyBalanceDto({
                marketId: market.id,
                tokenAddress: wethTokenAddress,
                tokenSymbol: "WETH",
              }),
            ],
            totalBorrowedUsd: "400",
            totalCollateralUsd: "1000",
            totalSuppliedUsd: "1000",
          }),
        },
      ],
      markets: [market],
    });
    const [position] = positions.items;

    if (!position) {
      throw new Error("Expected borrow position");
    }

    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "200",
        collateralAmount: "0",
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      positionsResult: AsyncResult.success(positions),
      tokenBalances: [],
    });

    expect(view.projection.maxLtv).toEqual(new BigNumber("0.5"));
    expect(view.projection.projectedHealthFactor).toEqual(new BigNumber(1));
    expect(view.validation.riskBlock).toBe("ltv");
    // 60% projected LTV is past the 52.5% blocking margin over 50% max LTV.
    expect(view.isActionReady).toBe(false);
  });

  it("allows review without presenting unavailable projected risk", () => {
    const market = makeBorrowMarket({
      collateralTokens: [makeBorrowCollateralTokenDto({ priceUsd: "0" })],
    });
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "1",
        collateralAmount: "1",
        selectedCollateralTokenId: decodeTokenId(
          market.collateralTokens[0]!.token
        ),
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      tokenBalances: Schema.decodeSync(TokenBalancesResponse)([
        {
          amount: "2",
          availableYields: [],
          token: {
            address: wethTokenAddress,
            decimals: 18,
            name: "Wrapped Ether",
            network: "ethereum",
            symbol: "WETH",
          },
        },
      ]),
    });

    expect(view.projection.riskStatus).toBe("unavailable");
    expect(view.isActionReady).toBe(true);
    expect(view.preparation?._tag).toBe("Ready");
    if (view.preparation?._tag !== "Ready") {
      throw new Error("Expected ready Borrow action preparation");
    }
    expect(view.preparation.review.summary).toMatchObject({
      riskStatus: "unavailable",
    });
    expect("projectedHealthFactor" in view.preparation.review.summary).toBe(
      false
    );
    expect("projectedLtv" in view.preparation.review.summary).toBe(false);
  });
});

/** Borrow reads answering `markets`, with `events` as the domain event stream. */
const makeEntryRegistry = ({
  events,
  markets,
}: {
  readonly events?: SubscriptionRef.SubscriptionRef<WidgetDomainEvent>;
  readonly markets: ReadonlyArray<Market>;
}) => {
  const borrowSource = Layer.succeed(BorrowResourceSource, {
    getIntegrations: Effect.succeed([]),
    getMarkets: () =>
      Effect.succeed({
        items: markets,
        limit: 100,
        offset: 0,
        total: markets.length,
      }),
    getPositionData: () => Effect.succeed([]),
  } as never);
  const layer = events
    ? Layer.merge(
        borrowSource,
        Layer.succeed(
          WidgetDomainEvents,
          WidgetDomainEvents.of({
            events: SubscriptionRef.changes(events),
            publish: () => Effect.void,
          })
        )
      )
    : borrowSource;

  return AtomRegistry.make({
    initialValues: [
      Atom.initialValue(appRuntime.layer, layer as never),
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

describe("Borrow Entry flow details", () => {
  /** Resolves the flow details once the market catalog has loaded. */
  const resolveFlowDetails = (markets: ReadonlyArray<Market>) =>
    Effect.promise(async () => {
      const registry = makeEntryRegistry({ markets });
      const details = borrowFlowDetailsAtom(borrowEntryFlowDetails);
      registry.mount(details);
      await vi.waitFor(() => {
        const catalog = registry.get(
          borrowMarketsAtom.foreground(
            new BorrowMarketsKey({
              network: borrowEntryFlowMarket.network,
              scope: registry.get(widgetConfigAtom).borrowMarketsScope,
            })
          )
        );
        expect(AsyncResult.isSuccess(catalog) && !catalog.waiting).toBe(true);
      });
      return registry.get(details);
    });

  it.effect("follows the live catalog entry of the captured market", () =>
    Effect.gen(function* () {
      const live = {
        ...borrowEntryFlowMarket,
        availableLiquidity: exactDecimal("1"),
      };

      const details = yield* resolveFlowDetails([live]);

      expect(details.market.availableLiquidity.toString()).toBe("1");
    })
  );

  it.effect("keeps the captured market when the catalog no longer has it", () =>
    Effect.gen(function* () {
      // Another market stays listed, so a first-market fallback would show.
      const otherMarket = {
        ...borrowEntryFlowMarket,
        id: MarketId.make("morpho-blue-borrow-base-weth-usdc-1"),
      };

      const details = yield* resolveFlowDetails([otherMarket]);

      expect(details.market).toBe(borrowEntryFlowMarket);
      expect(details.collateralToken).toBe(
        borrowEntryFlowDetails.collateralToken
      );
    })
  );

  it.effect("keeps the captured collateral when the live market drops it", () =>
    Effect.gen(function* () {
      const live = { ...borrowEntryFlowMarket, collateralTokens: [] };

      const details = yield* resolveFlowDetails([live]);

      expect(details.market.collateralTokens).toEqual([]);
      expect(details.collateralToken).toBe(
        borrowEntryFlowDetails.collateralToken
      );
    })
  );
});
