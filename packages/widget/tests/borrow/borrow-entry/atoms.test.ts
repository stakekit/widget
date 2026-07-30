import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vitest";
import {
  normalizeWidgetConfig,
  widgetConfigAtom,
} from "../../../src/app/config/settings";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import { deriveBorrowPositions } from "../../../src/domain/borrow/positions/borrow-positions";
import { TokenBalancesResponse } from "../../../src/domain/schema/financial-models";
import { WalletAddress } from "../../../src/domain/schema/identifiers";
import {
  applyBorrowFormAction,
  BorrowEntryKey,
  type BorrowFormIntent,
  resolveBorrowEntryView,
  shouldResetBorrowFormForCatalog,
} from "../../../src/features/borrow/borrow-entry/model/borrow-entry";
import { currentBorrowEntryAtom } from "../../../src/features/borrow/borrow-entry/state/borrow-entry";
import { tokenBalancesScanAtom } from "../../../src/features/portfolio/state";
import { walletScopeAtom } from "../../../src/features/wallet/state";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom as borrowMarketsAtom,
} from "../../../src/resources/borrow-markets/borrow-markets";
import { BorrowResourceSource } from "../../../src/services/api/borrow-resource-source";
import { WalletScopeKey } from "../../../src/services/wallet/domain/scope";

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

describe("Borrow Entry atoms", () => {
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
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([integration]),
      intent,
      key: new BorrowEntryKey({
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

    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "0",
        collateralAmount: "0",
        selectedCollateralTokenAddress: null,
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
      const view = resolveBorrowEntryView({
        integrationsResult: AsyncResult.success([]),
        intent: {
          borrowAmount,
          collateralAmount: "1",
          selectedCollateralTokenAddress:
            market.collateralTokens[0]?.token.address ?? null,
          selectedMarketId: market.id,
        },
        key: new BorrowEntryKey({
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
        new BorrowMarketsKey({ network: "ethereum" })
      )
    );

    const view = registry.get(currentBorrowEntryAtom);

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

    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "500",
        collateralAmount: "0",
        selectedCollateralTokenAddress:
          market.collateralTokens[0]?.token.address ?? null,
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

    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "200",
        collateralAmount: "0",
        selectedCollateralTokenAddress:
          selectedMarket.collateralTokens[0]?.token.address ?? null,
        selectedMarketId: selectedMarket.id,
      },
      key: new BorrowEntryKey({
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

    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([integration]),
      intent: {
        borrowAmount: "200",
        collateralAmount: "0",
        selectedCollateralTokenAddress:
          market.collateralTokens[0]?.token.address ?? null,
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
    const view = resolveBorrowEntryView({
      integrationsResult: AsyncResult.success([]),
      intent: {
        borrowAmount: "1",
        collateralAmount: "1",
        selectedCollateralTokenAddress:
          market.collateralTokens[0]?.token.address ?? null,
        selectedMarketId: market.id,
      },
      key: new BorrowEntryKey({
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
