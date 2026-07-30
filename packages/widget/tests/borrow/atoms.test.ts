import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../src/app/config/settings";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { BorrowAccountSnapshot } from "../../src/domain/borrow/borrow-account-snapshot";
import {
  deriveBorrowPositions,
  emptyBorrowPositions,
} from "../../src/domain/borrow/borrow-positions";
import { Integration } from "../../src/domain/borrow/integration";
import { Market } from "../../src/domain/borrow/market";
import { TokenBalancesResponse } from "../../src/domain/schema/financial-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  applyBorrowFormAction,
  BorrowDashboardKey,
  type BorrowFormIntent,
  resolveBorrowDashboardView,
  shouldResetBorrowFormForCatalog,
} from "../../src/features/borrow/model/borrow-form";
import { getBorrowPositionActions } from "../../src/features/borrow/model/position-details-model";
import { currentBorrowDashboardAtom } from "../../src/features/borrow/state/form";
import {
  borrowRepayFormAtom,
  makeBorrowPositionActionRouteKey,
  stageBorrowPositionActionAtom,
} from "../../src/features/borrow/state/position-action-form";
import {
  BorrowPositionKey,
  BorrowPositionNotFound,
  borrowPositionAtom,
  currentBorrowPositionsAtom,
} from "../../src/features/borrow/state/resources";
import { tokenBalancesScanAtom } from "../../src/features/portfolio/state";
import { walletScopeAtom } from "../../src/features/wallet/state";
import { BorrowResourceError as BorrowAtomError } from "../../src/resources/borrow/borrow-resource-error";
import { borrowIntegrationsResourceAtom as borrowIntegrationsAtom } from "../../src/resources/borrow-integrations/borrow-integrations";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom as borrowMarketsAtom,
} from "../../src/resources/borrow-markets/borrow-markets";
import {
  BorrowPositionsKey,
  borrowPositionsResourceAtom as borrowPositionsAtom,
} from "../../src/resources/borrow-positions/borrow-positions";
import {
  BorrowResourceSource,
  makeBorrowResourceSource,
} from "../../src/services/api/borrow-resource-source";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";

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

const makeRegistry = (borrow: Record<string, unknown>) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(Layer.succeed(BorrowResourceSource, borrow as never))
      ),
    ],
  });

describe("borrow atoms", () => {
  it("fetches, decodes, and derives borrow positions through atom resources", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const registry = makeRegistry({
      getIntegrations: () => Effect.succeed([integration]),
      getMarkets: () =>
        Effect.succeed({
          items: [market],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      getPositionData: () => Effect.succeed([{ integration, position }]),
    });

    const result = registry.get(
      borrowPositionsAtom(
        new BorrowPositionsKey({
          scope: walletScope,
        })
      )
    );

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value.items[0]?.id).toBe(marketDto.id);
      expect(result.value.items[0]?.balances.debt?.balance).toBe(400);
    }
  });

  it("resolves current borrow positions from wallet scope inside the atom runtime", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
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
                Effect.succeed([{ integration, position }]),
            } as never)
          )
        ),
        Atom.initialValue(walletScopeAtom, walletScope),
        Atom.initialValue(
          widgetConfigAtom,
          normalizeWidgetConfig({
            apiKey: "api-key",
            borrowEnabled: true,
            dashboardVariant: true,
            variant: "default",
          })
        ),
      ],
    });

    expect(
      AsyncResult.getOrThrow(registry.get(currentBorrowPositionsAtom))[0]?.id
    ).toBe(market.id);
  });

  it("owns staged position preparation and derives Ready from current intent", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const accountSnapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
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
    let currentAccountSnapshot = accountSnapshot;
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
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
          } as never)
        ),
        Atom.initialValue(walletScopeAtom, walletScope),
        Atom.initialValue(
          widgetConfigAtom,
          normalizeWidgetConfig({
            apiKey: "api-key",
            borrowEnabled: true,
            dashboardVariant: true,
            variant: "default",
          })
        ),
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

    registry.set(stageBorrowPositionActionAtom, action);
    const formAtom = borrowRepayFormAtom(
      makeBorrowPositionActionRouteKey(action)
    );
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
      _tag: "Blocked",
      reasons: ["AmountExceedsPositionBalance"],
    });
    registry.dispose();
  });

  it("returns inert resources without calling Borrow transport when disabled", () => {
    const getIntegrations = vi.fn();
    const getMarkets = vi.fn();
    const getPositionData = vi.fn();
    const source = makeBorrowResourceSource(
      {
        IntegrationsControllerGetIntegrationsV1: getIntegrations,
        MarketsControllerGetMarketsV1: getMarkets,
        PositionsControllerGetPositionsV1: getPositionData,
      } as never,
      false
    );
    const registry = makeRegistry(source);

    expect(
      AsyncResult.getOrThrow(registry.get(borrowIntegrationsAtom))
    ).toEqual([]);
    expect(
      AsyncResult.getOrThrow(
        registry.get(
          borrowMarketsAtom(new BorrowMarketsKey({ network: "ethereum" }))
        )
      )
    ).toEqual([]);
    expect(
      AsyncResult.getOrThrow(
        registry.get(
          borrowPositionsAtom(new BorrowPositionsKey({ scope: walletScope }))
        )
      )
    ).toMatchObject({ items: [] });
    expect(getIntegrations).not.toHaveBeenCalled();
    expect(getMarkets).not.toHaveBeenCalled();
    expect(getPositionData).not.toHaveBeenCalled();
  });

  it("shares one positions request between list and detail consumers", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const getIntegrations = vi.fn(() => Effect.succeed([integration]));
    const getMarkets = vi.fn(() =>
      Effect.succeed({
        items: [market],
        limit: 100,
        offset: 0,
        total: 1,
      })
    );
    const getPositionData = vi.fn(() =>
      Effect.succeed([{ integration, position }])
    );
    const registry = makeRegistry({
      getIntegrations,
      getMarkets,
      getPositionData,
    });

    expect(
      AsyncResult.getOrThrow(registry.get(borrowIntegrationsAtom))
    ).toHaveLength(1);
    expect(
      AsyncResult.getOrThrow(
        registry.get(
          borrowMarketsAtom(new BorrowMarketsKey({ network: "ethereum" }))
        )
      )
    ).toHaveLength(1);
    const list = registry.get(
      borrowPositionsAtom(new BorrowPositionsKey({ scope: walletScope }))
    );
    const detail = registry.get(
      borrowPositionAtom(
        new BorrowPositionKey({ marketId: market.id, scope: walletScope })
      )
    );

    expect(AsyncResult.getOrThrow(list).items[0]?.id).toBe(market.id);
    expect(AsyncResult.getOrThrow(detail).id).toBe(market.id);
    expect(getIntegrations).toHaveBeenCalledOnce();
    expect(getMarkets).toHaveBeenCalledOnce();
    expect(getPositionData).toHaveBeenCalledOnce();
  });

  it("shares positions when only unused additional addresses differ", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const getPositionData = vi.fn(() =>
      Effect.succeed([{ integration, position }])
    );
    const registry = makeRegistry({
      getIntegrations: () => Effect.succeed([integration]),
      getMarkets: () =>
        Effect.succeed({
          items: [market],
          limit: 100,
          offset: 0,
          total: 1,
        }),
      getPositionData,
    });
    const scopeWithAdditionalAddress = new WalletScopeKey({
      additionalAddresses: { binanceBeaconAddress: "bnb-address" },
      address,
      network: "ethereum",
    });
    const first = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: walletScope })
    );
    const second = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: scopeWithAdditionalAddress })
    );

    expect(second).toBe(first);
    expect(AsyncResult.getOrThrow(registry.get(first)).items).toHaveLength(1);
    expect(AsyncResult.getOrThrow(registry.get(second)).items).toHaveLength(1);
    expect(getPositionData).toHaveBeenCalledOnce();
  });

  it("loads complete market pages and keeps network identities separate", () => {
    const ethereumMarket = Schema.decodeUnknownSync(Market)(marketDto);
    const baseMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      id: "aave-v3-base-usdc",
      network: "base",
    });
    const getMarkets = vi.fn(
      ({
        network,
        offset,
      }: {
        network: "base" | "ethereum";
        offset: number;
      }) => {
        const getItems = () => {
          if (network === "base") return [baseMarket];
          if (offset !== 0) {
            return [
              Schema.decodeUnknownSync(Market)({
                ...marketDto,
                id: "aave-v3-ethereum-usdt",
              }),
            ];
          }
          return [ethereumMarket];
        };
        const items = getItems();

        return Effect.succeed({
          items,
          limit: 100,
          offset,
          total: network === "base" ? 1 : 101,
        });
      }
    );
    const registry = makeRegistry({ getMarkets });
    const ethereum = borrowMarketsAtom(
      new BorrowMarketsKey({ network: "ethereum" })
    );
    const equivalentEthereum = borrowMarketsAtom(
      new BorrowMarketsKey({ network: "ethereum" })
    );
    const base = borrowMarketsAtom(new BorrowMarketsKey({ network: "base" }));

    expect(AsyncResult.getOrThrow(registry.get(ethereum))).toHaveLength(2);
    expect(
      AsyncResult.getOrThrow(registry.get(equivalentEthereum))
    ).toHaveLength(2);
    expect(AsyncResult.getOrThrow(registry.get(base))).toEqual([baseMarket]);
    expect(getMarkets.mock.calls.map(([request]) => request)).toEqual([
      { limit: 100, network: "ethereum", offset: 0, scope: "all" },
      { limit: 100, network: "ethereum", offset: 100, scope: "all" },
      { limit: 100, network: "base", offset: 0, scope: "all" },
    ]);
  });

  it("preserves base previous values and errors while typing absent details", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const accountPosition = Schema.decodeUnknownSync(BorrowAccountSnapshot)(
      positionDto
    );
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        { accountSnapshot: accountPosition, integration },
      ],
      markets: [market],
    });
    const base = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: walletScope })
    );
    const detail = borrowPositionAtom(
      new BorrowPositionKey({ marketId: market.id, scope: walletScope })
    );
    const waitingRegistry = AtomRegistry.make({
      initialValues: [
        [base, AsyncResult.waiting(AsyncResult.success(positions))],
      ],
    });
    const waiting = waitingRegistry.get(detail);

    expect(waiting.waiting).toBe(true);
    expect(AsyncResult.getOrThrow(waiting).id).toBe(market.id);

    const error = new BorrowAtomError({
      cause: new Error("refresh failed"),
      operation: "borrow-positions",
    });
    const failureRegistry = AtomRegistry.make({
      initialValues: [
        [
          base,
          AsyncResult.failWithPrevious(error, {
            previous: Option.some(AsyncResult.success(positions)),
            waiting: false,
          }),
        ],
      ],
    });
    const failure = failureRegistry.get(detail);

    expect(AsyncResult.isFailure(failure)).toBe(true);
    expect(Option.getOrThrow(AsyncResult.value(failure)).id).toBe(market.id);
    if (!AsyncResult.isFailure(failure)) throw new Error("Expected failure");
    expect(Option.getOrThrow(Cause.findErrorOption(failure.cause))).toBe(error);

    const absentRegistry = AtomRegistry.make({
      initialValues: [[base, AsyncResult.success(emptyBorrowPositions)]],
    });
    const absent = absentRegistry.get(detail);

    expect(AsyncResult.isFailure(absent)).toBe(true);
    if (!AsyncResult.isFailure(absent)) throw new Error("Expected failure");
    expect(Option.getOrThrow(Cause.findErrorOption(absent.cause))).toEqual(
      new BorrowPositionNotFound({ marketId: market.id })
    );
  });

  it("wraps borrow API failures in AsyncResult failure state", () => {
    const registry = makeRegistry({
      getIntegrations: () => Effect.fail(new Error("borrow unavailable")),
    });
    const result = registry.get(borrowIntegrationsAtom);

    expect(AsyncResult.isFailure(result)).toBe(true);
    if (AsyncResult.isFailure(result)) {
      const error = Cause.findErrorOption(result.cause);

      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(BorrowAtomError);
        expect("operation" in error.value).toBe(true);
        if ("operation" in error.value) {
          expect(error.value.operation).toBe("borrow-integrations");
        }
      }
    }
  });

  it("reduces form intent and prepares borrow review state in the atom view", () => {
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const selectedIntent = applyBorrowFormAction({
      action: {
        marketId: market.id,
        type: "market/select",
      },
      intent: {
        borrowAmount: "1",
        collateralAmount: "2",
        selectedCollateralTokenAddress:
          market.collateralTokens[0]?.token.address ?? null,
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
    const view = resolveBorrowDashboardView({
      integrationsResult: AsyncResult.success([integration]),
      intent,
      key: new BorrowDashboardKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      tokenBalances: Schema.decodeUnknownSync(TokenBalancesResponse)([
        {
          amount: "2",
          availableYields: [],
          token: {
            address: marketDto.collateralTokens[0].token.address,
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

  it("defaults the form to the first market where borrowing is enabled", () => {
    const disabledMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      id: "disabled-market",
      isBorrowEnabled: false,
    });
    const enabledMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      id: "enabled-market",
    });

    const view = resolveBorrowDashboardView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "0",
        collateralAmount: "0",
        selectedCollateralTokenAddress: null,
        selectedMarketId: null,
      },
      key: new BorrowDashboardKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([disabledMarket, enabledMarket]),
      tokenBalances: [],
    });

    expect(view.selectedMarketId).toBe(enabledMarket.id);
    expect(view.markets.map((market) => market.id)).toEqual([enabledMarket.id]);
  });

  it.each([
    { borrowAmount: "5", expectedReady: true, minLoan: null },
    { borrowAmount: "5", expectedReady: true, minLoan: "0" },
    { borrowAmount: "10", expectedReady: true, minLoan: "10" },
    { borrowAmount: "9.99", expectedReady: false, minLoan: "10" },
    { borrowAmount: "10.01", expectedReady: true, minLoan: "10" },
  ])(
    "enforces the projected debt floor for minLoan=$minLoan and borrowAmount=$borrowAmount",
    ({ borrowAmount, expectedReady, minLoan }) => {
      const market = Schema.decodeUnknownSync(Market)({
        ...marketDto,
        minLoan,
      });
      const view = resolveBorrowDashboardView({
        integrationsResult: AsyncResult.success([]),
        intent: {
          borrowAmount,
          collateralAmount: "1",
          selectedCollateralTokenAddress:
            market.collateralTokens[0]?.token.address ?? null,
          selectedMarketId: market.id,
        },
        key: new BorrowDashboardKey({
          network: "ethereum",
          scope: walletScope,
        }),
        marketsResult: AsyncResult.success([market]),
        tokenBalances: Schema.decodeUnknownSync(TokenBalancesResponse)([
          {
            amount: "2",
            availableYields: [],
            token: {
              address: marketDto.collateralTokens[0].token.address,
              decimals: 18,
              name: "Wrapped Ether",
              network: "ethereum",
              symbol: "WETH",
            },
          },
        ]),
      });

      expect(view.isActionReady).toBe(expectedReady);
      expect(view.validation.projectedDebtBelowMinimum).toBe(!expectedReady);
      expect(view.preparation?._tag === "Ready").toBe(expectedReady);
    }
  );

  it("resets persisted form intent when a successful refresh removes the selected market", () => {
    const selectedMarket = Schema.decodeUnknownSync(Market)(marketDto);
    const replacementMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      id: "replacement-market",
    });
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    let catalog = [selectedMarket];
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(BorrowResourceSource, {
            getIntegrations: () => Effect.succeed([integration]),
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
        Atom.initialValue(
          widgetConfigAtom,
          normalizeWidgetConfig({
            apiKey: "api-key",
            borrowEnabled: true,
            dashboardVariant: true,
            variant: "default",
          })
        ),
        Atom.initialValue(tokenBalancesScanAtom, {
          enabled: true,
          result: AsyncResult.success([]),
        }),
      ],
    });

    expect(registry.get(currentBorrowDashboardAtom)?.selectedMarketId).toBe(
      selectedMarket.id
    );
    registry.set(currentBorrowDashboardAtom, {
      amount: "25",
      type: "borrowAmount/set",
    });
    registry.set(currentBorrowDashboardAtom, {
      amount: "1",
      type: "collateralAmount/set",
    });

    catalog = [replacementMarket];
    registry.refresh(
      borrowMarketsAtom.foreground(
        new BorrowMarketsKey({ network: "ethereum" })
      )
    );

    const view = registry.get(currentBorrowDashboardAtom);

    expect(view?.selectedMarketId).toBe(replacementMarket.id);
    expect(view?.borrowAmount.toString(10)).toBe("0");
    expect(view?.collateralAmount.toString(10)).toBe("0");
    expect(view?.catalogResetNotice).toBe(true);
  });

  it("uses stable catalog identities when deciding whether to reset the form", () => {
    const selectedMarket = Schema.decodeUnknownSync(Market)(marketDto);
    const otherMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      id: "other-market",
    });
    const intent: BorrowFormIntent = {
      borrowAmount: "25",
      collateralAmount: "1",
      selectedCollateralTokenAddress:
        selectedMarket.collateralTokens[0]?.token.address ?? null,
      selectedMarketId: selectedMarket.id,
    };

    expect(
      shouldResetBorrowFormForCatalog({
        intent,
        markets: [
          otherMarket,
          Schema.decodeUnknownSync(Market)({ ...marketDto }),
        ],
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
          Schema.decodeUnknownSync(Market)({
            ...marketDto,
            isBorrowEnabled: false,
          }),
        ],
      })
    ).toBe(true);
    expect(
      shouldResetBorrowFormForCatalog({
        intent,
        markets: [
          Schema.decodeUnknownSync(Market)({
            ...marketDto,
            collateralTokens: [],
          }),
        ],
      })
    ).toBe(true);
  });

  it("projects borrow form risk from existing selected-market positions", () => {
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: Schema.decodeUnknownSync(BorrowAccountSnapshot)({
            ...positionDto,
            supplyBalances: [
              {
                apy: "0.02",
                balance: "0.5",
                balanceRaw: "500000000000000000",
                balanceUsd: "1000",
                isCollateral: true,
                marketId: marketDto.id,
                pendingActions: [],
                tokenAddress: marketDto.collateralTokens[0].token.address,
                tokenSymbol: "WETH",
              },
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

    const view = resolveBorrowDashboardView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "500",
        collateralAmount: "0",
        selectedCollateralTokenAddress:
          market.collateralTokens[0]?.token.address ?? null,
        selectedMarketId: market.id,
      },
      key: new BorrowDashboardKey({
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
    expect(view.projection.projectedLtv).toBe(0.9);
    expect(view.validation.ltvGreaterThanMax).toBe(true);
  });

  it("projects a new pool market against same-integration account risk", () => {
    const existingMarket = Schema.decodeUnknownSync(Market)(marketDto);
    const selectedMarket = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      id: "aave-v3-ethereum-dai",
      loanToken: {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        decimals: 18,
        name: "Dai Stablecoin",
        symbol: "DAI",
      },
    });
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: Schema.decodeUnknownSync(BorrowAccountSnapshot)({
            ...positionDto,
            supplyBalances: [
              {
                apy: "0.02",
                balance: "0.5",
                balanceRaw: "500000000000000000",
                balanceUsd: "1000",
                isCollateral: true,
                marketId: existingMarket.id,
                pendingActions: [],
                tokenAddress: marketDto.collateralTokens[0].token.address,
                tokenSymbol: "WETH",
              },
            ],
            totalCollateralUsd: "1000",
            totalSuppliedUsd: "1000",
          }),
        },
      ],
      markets: [existingMarket, selectedMarket],
    });
    const [existingPosition] = positions.items;

    if (!existingPosition) {
      throw new Error("Expected existing pool position");
    }

    const view = resolveBorrowDashboardView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "200",
        collateralAmount: "0",
        selectedCollateralTokenAddress:
          selectedMarket.collateralTokens[0]?.token.address ?? null,
        selectedMarketId: selectedMarket.id,
      },
      key: new BorrowDashboardKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([existingMarket, selectedMarket]),
      positionsResult: AsyncResult.success(positions),
      tokenBalances: [],
    });

    expect(view.projection.existingCollateralUsd.toString(10)).toBe("1000");
    expect(view.projection.existingDebtUsd.toString(10)).toBe("400");
    expect(view.projection.projectedDebtUsd.toString(10)).toBe("600");
    expect(view.projection.projectedLtv).toBe(0.6);
    expect(view.validation.ltvGreaterThanMax).toBe(false);
  });

  it("validates borrow-only intent against the complete collateral composition", () => {
    const strictToken = {
      ...marketDto.collateralTokens[0],
      liquidationThreshold: "0.6",
      maxLtv: "0.5",
    };
    const defaultToken = {
      ...marketDto.collateralTokens[0],
      liquidationThreshold: "0.9",
      maxLtv: "0.8",
      token: {
        address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        decimals: 8,
        name: "Wrapped BTC",
        symbol: "WBTC",
      },
    };
    const market = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      collateralTokens: [defaultToken, strictToken],
    });
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: Schema.decodeUnknownSync(BorrowAccountSnapshot)({
            ...positionDto,
            debtBalances: [
              {
                ...positionDto.debtBalances[0],
                balance: "400",
                balanceUsd: "400",
              },
            ],
            supplyBalances: [
              {
                apy: "0.02",
                balance: "0.5",
                balanceRaw: "500000000000000000",
                balanceUsd: "1000",
                isCollateral: true,
                marketId: market.id,
                pendingActions: [],
                tokenAddress: strictToken.token.address,
                tokenSymbol: strictToken.token.symbol,
              },
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

    const view = resolveBorrowDashboardView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "200",
        collateralAmount: "0",
        selectedCollateralTokenAddress:
          market.collateralTokens[0]?.token.address ?? null,
        selectedMarketId: market.id,
      },
      key: new BorrowDashboardKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      positionsResult: AsyncResult.success(positions),
      tokenBalances: [],
    });

    expect(view.projection.maxLtv).toBe(0.5);
    expect(view.projection.projectedHealthFactor).toBe(1);
    expect(view.validation.ltvGreaterThanMax).toBe(true);
    expect(view.isActionReady).toBe(false);
  });

  it("allows review with an explicit warning when projected risk is unavailable", () => {
    const market = Schema.decodeUnknownSync(Market)({
      ...marketDto,
      collateralTokens: [
        {
          ...marketDto.collateralTokens[0],
          priceUsd: "0",
        },
      ],
    });
    const view = resolveBorrowDashboardView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "1",
        collateralAmount: "1",
        selectedCollateralTokenAddress:
          market.collateralTokens[0]?.token.address ?? null,
        selectedMarketId: market.id,
      },
      key: new BorrowDashboardKey({
        network: "ethereum",
        scope: walletScope,
      }),
      marketsResult: AsyncResult.success([market]),
      tokenBalances: Schema.decodeUnknownSync(TokenBalancesResponse)([
        {
          amount: "2",
          availableYields: [],
          token: {
            address: marketDto.collateralTokens[0].token.address,
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
