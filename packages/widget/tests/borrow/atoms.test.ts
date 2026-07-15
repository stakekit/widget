import { Cause, Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../src/app/runtime";
import { TokenBalancesResponse } from "../../src/domain/schema/financial-models";
import { WalletAddress } from "../../src/domain/schema/identifiers";
import {
  applyBorrowFormAction,
  BorrowAccountPosition,
  BorrowAtomError,
  BorrowDashboardKey,
  BorrowExecutionEventsService,
  type BorrowFormIntent,
  BorrowPositionsKey,
  BorrowSubmitFailedError,
  BorrowWalletExecutionService,
  borrowIntegrationsAtom,
  borrowPositionsAtom,
  deriveBorrowPositionItems,
  getBorrowExecutionSteps,
  Integration,
  Market,
  resolveBorrowDashboardView,
} from "../../src/features/borrow/core";
import { BorrowApiService } from "../../src/services/api/borrow-api-service";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

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
        Layer.mergeAll(
          Layer.succeed(BorrowApiService, borrow as never),
          Layer.succeed(BorrowWalletExecutionService, {} as never),
          Layer.succeed(BorrowExecutionEventsService, {} as never)
        )
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
          address,
          network: "ethereum",
        })
      )
    );

    expect(AsyncResult.isSuccess(result)).toBe(true);
    if (AsyncResult.isSuccess(result)) {
      expect(result.value[0]?.id).toBe(marketDto.id);
      expect(result.value[0]?.debtBalance?.balance).toBe(400);
    }
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
        walletAddress: address,
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
        walletAddress: address,
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

  it("projects execution retry and failure step state", () => {
    expect(
      getBorrowExecutionSteps({
        error: null,
        phase: "signing",
      }).map((step) => step.status)
    ).toEqual(["completed", "active", "pending", "pending"]);

    const error = new BorrowSubmitFailedError({
      cause: new Error("wallet rejected"),
      message: "Borrow action failed.",
      phase: "submitting",
    });

    expect(
      getBorrowExecutionSteps({
        error,
        phase: "submitting",
      }).map((step) => step.status)
    ).toEqual(["completed", "completed", "failed", "pending"]);
  });
});
