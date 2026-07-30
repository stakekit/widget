import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { decodeTokenId } from "../../../src/domain/borrow/ids";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import { deriveBorrowPositions } from "../../../src/domain/borrow/positions/borrow-positions";

const address = "0x0000000000000000000000000000000000000001";
const integrationDto = {
  actions: [],
  id: "aave-borrow",
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
  name: "Aave V3",
  networks: ["ethereum"],
  providerId: "aave",
} as const;
const collateralToken = {
  liquidationPenalty: "0.05",
  liquidationThreshold: "0.85",
  maxLtv: "0.8",
  priceUsd: "2000",
  supplyRate: "0.02",
  token: {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    decimals: 18,
    name: "Wrapped Ether",
    symbol: "WETH",
  },
} as const;
const makeMarket = ({
  id,
  integrationId = integrationDto.id,
  loanTokenAddress,
  loanTokenSymbol,
  type = "pool",
}: {
  readonly id: string;
  readonly integrationId?: string;
  readonly loanTokenAddress: string;
  readonly loanTokenSymbol: string;
  readonly type?: "isolated" | "pool";
}) =>
  Schema.decodeUnknownSync(Market)({
    availableLiquidity: "500000",
    availableLiquidityRaw: "500000000000",
    borrowRate: "0.06",
    collateralTokens: [collateralToken],
    feeWrapperAddress: null,
    id,
    integrationId,
    isBorrowEnabled: true,
    loanToken: {
      address: loanTokenAddress,
      decimals: 6,
      name: loanTokenSymbol,
      symbol: loanTokenSymbol,
    },
    loanTokenPriceUsd: "1",
    minLoan: null,
    network: "ethereum",
    poolAddress: "0x0000000000000000000000000000000000000001",
    supplyCollateralFeeBps: "0",
    totalBorrow: "500000",
    totalBorrowRaw: "500000000000",
    totalSupply: "1000000",
    totalSupplyRaw: "1000000000000",
    type,
    utilizationRate: "0.5",
  });

describe("BorrowPositions", () => {
  it("decodes underwater current LTV without hiding the account snapshot", () => {
    const usdcMarket = makeMarket({
      id: "aave-v3-ethereum-usdc",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
    });

    expect(
      Schema.decodeUnknownSync(BorrowAccountSnapshot)({
        address,
        availableToBorrowUsd: "0",
        currentLtv: "1.2",
        debtBalances: [
          {
            apy: "0.06",
            balance: "1200",
            balanceRaw: "1200000000",
            balanceUsd: "1200",
            marketId: usdcMarket.id,
            pendingActions: [],
            tokenAddress: usdcMarket.loanToken.address,
            tokenSymbol: "USDC",
          },
        ],
        healthFactor: "0.7",
        integrationId: integrationDto.id,
        netApy: "-0.06",
        netWorthUsd: "-200",
        network: "ethereum",
        supplyBalances: [],
        totalBorrowedUsd: "1200",
        totalCollateralUsd: "1000",
        totalSuppliedUsd: "1000",
      }).currentLtv
    ).toBe(1.2);
  });

  it("shares account risk with a pool market that has no local position", () => {
    const usdcMarket = makeMarket({
      id: "aave-v3-ethereum-usdc",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
    });
    const daiMarket = makeMarket({
      id: "aave-v3-ethereum-dai",
      loanTokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      loanTokenSymbol: "DAI",
    });
    const integration = Schema.decodeUnknownSync(Integration)(integrationDto);
    const snapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
      address,
      availableToBorrowUsd: "400",
      currentLtv: "0.4",
      debtBalances: [
        {
          apy: "0.06",
          balance: "400",
          balanceRaw: "400000000",
          balanceUsd: "400",
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: usdcMarket.loanToken.address,
          tokenSymbol: "USDC",
        },
      ],
      healthFactor: "2.125",
      integrationId: integration.id,
      netApy: "-0.006",
      netWorthUsd: "600",
      network: "ethereum",
      supplyBalances: [
        {
          apy: "0.02",
          balance: "0.5",
          balanceRaw: "500000000000000000",
          balanceUsd: "1000",
          isCollateral: true,
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: collateralToken.token.address,
          tokenSymbol: collateralToken.token.symbol,
        },
      ],
      totalBorrowedUsd: "400",
      totalCollateralUsd: "1000",
      totalSuppliedUsd: "1000",
    });
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [{ accountSnapshot: snapshot, integration }],
      markets: [usdcMarket, daiMarket],
    });
    const existing = positions.items.find(
      (position) => position.id === usdcMarket.id
    );
    const newMarketRisk = positions.riskFor(daiMarket);

    expect(existing?.risk).toBe(newMarketRisk);
    expect(newMarketRisk.scope).toBe("account");
    expect(newMarketRisk.current).toMatchObject({
      healthFactor: 2.125,
      ltv: 0.4,
      status: "available",
      totalCollateralUsd: 1000,
      totalDebtUsd: 400,
    });

    expect(
      newMarketRisk.assess([
        {
          amount: 200,
          marketId: daiMarket.id,
          type: "borrow",
        },
      ])
    ).toMatchObject({
      decision: "allow",
      projection: {
        ltv: 0.6,
        status: "available",
        totalCollateralUsd: 1000,
        totalDebtUsd: 600,
      },
    });

    const conflictingPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: {
            ...snapshot,
            totalCollateralUsd: 1200,
          },
        },
      ],
      markets: [usdcMarket, daiMarket],
    });
    expect(conflictingPositions.riskFor(usdcMarket).current).toMatchObject({
      reason: "conflictingCollateralTotal",
      status: "unavailable",
    });

    const nonCollateralPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: {
            ...snapshot,
            availableToBorrowUsd: 0,
            currentLtv: 1,
            healthFactor: null,
            supplyBalances: snapshot.supplyBalances.map((balance) => ({
              ...balance,
              isCollateral: false,
            })),
            totalCollateralUsd: 0,
          },
        },
      ],
      markets: [usdcMarket],
    });
    expect(
      nonCollateralPositions.riskFor(usdcMarket).assess([
        {
          amount: 0.1,
          tokenId: decodeTokenId({
            address: usdcMarket.collateralTokens[0]!.token.address,
            symbol: usdcMarket.collateralTokens[0]!.token.symbol,
          }),
          type: "withdraw",
        },
      ])
    ).toMatchObject({
      decision: "allow",
      projection: {
        borrowCapacityUsd: 0,
        status: "available",
        totalDebtUsd: 400,
      },
    });
  });

  it("keeps isolated market risk independent from account totals", () => {
    const usdcMarket = makeMarket({
      id: "morpho-blue-ethereum-weth-usdc",
      integrationId: "morpho-blue-borrow",
      loanTokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      loanTokenSymbol: "USDC",
      type: "isolated",
    });
    const daiMarket = makeMarket({
      id: "morpho-blue-ethereum-weth-dai",
      integrationId: "morpho-blue-borrow",
      loanTokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      loanTokenSymbol: "DAI",
      type: "isolated",
    });
    const integration = Schema.decodeUnknownSync(Integration)({
      ...integrationDto,
      id: "morpho-blue-borrow",
      name: "Morpho Blue",
      providerId: "morpho-blue",
    });
    const snapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
      address,
      availableToBorrowUsd: null,
      currentLtv: "0.4",
      debtBalances: [
        {
          apy: "0.06",
          balance: "400",
          balanceRaw: "400000000",
          balanceUsd: "400",
          marketId: usdcMarket.id,
          pendingActions: [],
          tokenAddress: usdcMarket.loanToken.address,
          tokenSymbol: "USDC",
        },
      ],
      healthFactor: null,
      integrationId: integration.id,
      netApy: "-0.006",
      netWorthUsd: "1600",
      network: "ethereum",
      supplyBalances: [
        {
          apy: "0.02",
          balance: "1",
          balanceRaw: "1000000000000000000",
          balanceUsd: "2000",
          isCollateral: true,
          marketId: usdcMarket.id,
          pendingActions: [],
          positionState: {
            availableToBorrowUsd: "1200",
            currentLtv: "0.2",
            healthFactor: "4.25",
            liquidationThreshold: "0.85",
          },
          tokenAddress: collateralToken.token.address,
          tokenSymbol: collateralToken.token.symbol,
        },
      ],
      totalBorrowedUsd: "400",
      totalCollateralUsd: "2000",
      totalSuppliedUsd: "2000",
    });
    const positions = deriveBorrowPositions({
      integrationAccountSnapshots: [{ accountSnapshot: snapshot, integration }],
      markets: [usdcMarket, daiMarket],
    });
    const usdcRisk = positions.riskFor(usdcMarket);
    const daiRisk = positions.riskFor(daiMarket);

    expect(usdcRisk).not.toBe(daiRisk);
    expect(usdcRisk.scope).toBe("market");
    expect(usdcRisk.current).toMatchObject({
      healthFactor: 4.25,
      ltv: 0.2,
      status: "available",
      totalCollateralUsd: 2000,
      totalDebtUsd: 400,
    });
    expect(daiRisk.current).toMatchObject({
      ltv: 0,
      status: "available",
      totalCollateralUsd: 0,
      totalDebtUsd: 0,
    });

    const conflictingPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        {
          integration,
          accountSnapshot: {
            ...snapshot,
            supplyBalances: [
              ...snapshot.supplyBalances,
              {
                ...snapshot.supplyBalances[0]!,
                balance: 0,
                balanceRaw: 0n,
                balanceUsd: 0,
                positionState: {
                  availableToBorrowUsd: 1000,
                  currentLtv: 0.3,
                  healthFactor: 3,
                  liquidationThreshold: 0.85,
                },
              },
            ],
          },
        },
      ],
      markets: [usdcMarket],
    });

    expect(conflictingPositions.riskFor(usdcMarket).current).toMatchObject({
      reason: "conflictingPositionState",
      status: "unavailable",
    });
  });
});
