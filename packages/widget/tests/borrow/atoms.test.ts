import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it, vi } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { Integration } from "../../src/domain/borrow/integration";
import { Market } from "../../src/domain/borrow/market";
import { BorrowAccountPosition } from "../../src/domain/borrow/position";
import { deriveBorrowPositionItems } from "../../src/domain/borrow/position-items";
import { TokenBalancesResponse } from "../../src/domain/schema/financial-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  applyBorrowFormAction,
  BorrowDashboardKey,
  type BorrowFormIntent,
  resolveBorrowDashboardView,
} from "../../src/features/borrow/atoms/form";
import {
  BorrowAtomError,
  BorrowMarketsKey,
  BorrowPositionKey,
  BorrowPositionNotFound,
  BorrowPositionsKey,
  borrowIntegrationsAtom,
  borrowMarketsAtom,
  borrowPositionAtom,
  borrowPositionsAtom,
  currentBorrowPositionsAtom,
} from "../../src/features/borrow/atoms/resources";
import { currentWalletScopeAtom } from "../../src/features/wallet/state/selectors";
import { BorrowApiService } from "../../src/services/api/borrow-api-service";
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
        Layer.mergeAll(Layer.succeed(BorrowApiService, borrow as never))
      ),
    ],
  });

describe("borrow atoms", () => {
  it("fetches, decodes, and derives borrow positions through atom resources", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountPosition)(
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
      expect(result.value[0]?.id).toBe(marketDto.id);
      expect(result.value[0]?.debtBalance?.balance).toBe(400);
    }
  });

  it("resolves current borrow positions from wallet scope inside the atom runtime", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountPosition)(
      positionDto
    );
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Layer.succeed(BorrowApiService, {
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
        Atom.initialValue(currentWalletScopeAtom, walletScope),
      ],
    });

    expect(
      AsyncResult.getOrThrow(registry.get(currentBorrowPositionsAtom(true)))[0]
        ?.id
    ).toBe(market.id);
  });

  it("shares one positions request between list and detail consumers", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const position = Schema.decodeUnknownSync(BorrowAccountPosition)(
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

    expect(AsyncResult.getOrThrow(list)[0]?.id).toBe(market.id);
    expect(AsyncResult.getOrThrow(detail).id).toBe(market.id);
    expect(getIntegrations).toHaveBeenCalledOnce();
    expect(getMarkets).toHaveBeenCalledOnce();
    expect(getPositionData).toHaveBeenCalledOnce();
  });

  it("preserves base previous values and errors while typing absent details", () => {
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const accountPosition = Schema.decodeUnknownSync(BorrowAccountPosition)(
      positionDto
    );
    const position = deriveBorrowPositionItems({
      integrationPositions: [{ integration, position: accountPosition }],
      markets: [market],
    })[0]!;
    const base = borrowPositionsAtom(
      new BorrowPositionsKey({ scope: walletScope })
    );
    const detail = borrowPositionAtom(
      new BorrowPositionKey({ marketId: market.id, scope: walletScope })
    );
    const waitingRegistry = AtomRegistry.make({
      initialValues: [
        [base, AsyncResult.waiting(AsyncResult.success([position]))],
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
            previous: Option.some(AsyncResult.success([position])),
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
      initialValues: [[base, AsyncResult.success([])]],
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
    expect(view.preparedReviewState?.request).toMatchObject({
      action: "borrow",
      address,
      args: {
        amount: "25",
        collateralAmount: "1",
        marketId: market.id,
      },
    });
  });

  it("projects borrow form risk from existing selected-market positions", () => {
    const market = Schema.decodeUnknownSync(Market)(marketDto);
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const [position] = deriveBorrowPositionItems({
      integrationPositions: [
        {
          integration,
          position: Schema.decodeUnknownSync(BorrowAccountPosition)({
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
      positionsResult: AsyncResult.success([position]),
      tokenBalances: [],
    });

    expect(view.projection.existingCollateralUsd.toString(10)).toBe("1000");
    expect(view.projection.existingDebtUsd.toString(10)).toBe("400");
    expect(view.projection.projectedCollateralUsd.toString(10)).toBe("1000");
    expect(view.projection.projectedDebtUsd.toString(10)).toBe("900");
    expect(view.projection.projectedLtv).toBe(0.9);
    expect(view.validation.ltvGreaterThanMax).toBe(true);
  });
});
