import BigNumber from "bignumber.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { Market } from "../../../src/domain/borrow/catalog/market";
import { MarketId, TokenAddress } from "../../../src/domain/borrow/ids";
import { BorrowAccountSnapshot } from "../../../src/domain/borrow/positions/borrow-account-snapshot";
import {
  deriveBorrowPositions,
  emptyBorrowPositions,
} from "../../../src/domain/borrow/positions/borrow-positions";
import { TokenBalancesResponse } from "../../../src/domain/finance/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { prepareBorrowAction } from "../../../src/features/borrow/action-preparation/model/prepare";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);
const loanTokenAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const collateralTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

const integration = Schema.decodeUnknownSync(Integration)({
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
});

const market = Schema.decodeUnknownSync(Market)({
  availableLiquidity: "500000",
  availableLiquidityRaw: "500000000000",
  borrowRate: "0.06",
  collateralTokens: [
    {
      liquidationPenalty: "0.05",
      liquidationThreshold: "0.85",
      maxLtv: "0.8",
      priceUsd: "2000",
      supplyRate: "0.02",
      token: {
        address: collateralTokenAddress,
        decimals: 18,
        name: "Wrapped Ether",
        symbol: "WETH",
      },
    },
  ],
  feeWrapperAddress: null,
  id: "aave-v3-ethereum-usdc",
  integrationId: integration.id,
  isBorrowEnabled: true,
  loanToken: {
    address: loanTokenAddress,
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  loanTokenPriceUsd: "1",
  minLoan: null,
  network: "ethereum",
  originationFeeBps: "0",
  originationFeeWrapperAddress: null,
  poolAddress: "0x0000000000000000000000000000000000000001",
  supplyCollateralFeeBps: "0",
  totalBorrow: "500000",
  totalBorrowRaw: "500000000000",
  totalSupply: "1000000",
  totalSupplyRaw: "1000000000000",
  type: "pool",
  utilizationRate: "0.5",
});

const accountSnapshot = Schema.decodeUnknownSync(BorrowAccountSnapshot)({
  address,
  availableToBorrowUsd: "450",
  currentLtv: "0.4",
  debtBalances: [
    {
      apy: "0.06",
      balance: "400",
      balanceRaw: "400000000",
      balanceUsd: "400",
      marketId: market.id,
      pendingActions: [
        {
          args: { marketId: market.id, tokenAddress: loanTokenAddress },
          label: "Repay",
          type: "repay",
        },
      ],
      tokenAddress: loanTokenAddress,
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
      marketId: market.id,
      pendingActions: [
        {
          args: {
            amountRaw: "500000000000000000",
            marketId: market.id,
            tokenAddress: collateralTokenAddress,
          },
          label: "Withdraw",
          type: "withdraw",
        },
        {
          args: {
            marketId: market.id,
            tokenAddress: collateralTokenAddress,
          },
          label: "Disable collateral",
          type: "disableCollateral",
        },
      ],
      tokenAddress: collateralTokenAddress,
      tokenSymbol: "WETH",
    },
  ],
  totalBorrowedUsd: "400",
  totalCollateralUsd: "1000",
  totalSuppliedUsd: "1000",
});

const positions = deriveBorrowPositions({
  integrationAccountSnapshots: [{ accountSnapshot, integration }],
  markets: [market],
});

const tokenBalances = Schema.decodeUnknownSync(TokenBalancesResponse)([
  {
    amount: "2",
    availableYields: [],
    token: {
      address: collateralTokenAddress,
      decimals: 18,
      name: "Wrapped Ether",
      network: "ethereum",
      symbol: "WETH",
    },
  },
]);

const position = positions.items[0]!;
const repayAction = position.actions.debt.find(
  (action) => action.type === "repay"
);
const debtBalance = position.balances.debt;
const withdrawAction = position.actions.supply.find(
  (action) => action.type === "withdraw"
);
const disableCollateralAction = position.actions.supply.find(
  (action) => action.type === "disableCollateral"
);
const supplyBalance = position.balances.supply[0];
const collateralToken = position.market.collateralTokens[0];

if (
  !repayAction ||
  !debtBalance ||
  !withdrawAction ||
  !disableCollateralAction ||
  !supplyBalance ||
  !collateralToken
) {
  throw new Error("Expected position action context");
}

describe("Borrow action preparation", () => {
  it("creates one aligned command and review for borrowing with collateral", () => {
    const result = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber(25),
      collateralAmount: new BigNumber(1),
      collateralToken: market.collateralTokens[0]!,
      integrations: [integration],
      market,
      positions,
      tokenBalances,
    });

    expect(result._tag).toBe("Ready");
    if (result._tag !== "Ready") {
      return;
    }

    expect(result.review).toMatchObject({
      command: {
        action: "borrow",
        address,
        args: {
          amount: "25",
          collateralAmount: "1",
          collateralTokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          marketId: market.id,
          tokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        },
        integrationId: integration.id,
      },
      summary: {
        action: "borrowAndSupply",
        borrowAmount: "25",
        collateralAmount: "1",
        collateralTokenSymbol: "WETH",
        existingCollateralUsd: "1000",
        existingDebtUsd: "400",
        loanTokenSymbol: "USDC",
        marketLabel: "WETH / USDC",
        network: "ethereum",
        projectedCollateralUsd: "3000",
        projectedDebtUsd: "425",
        providerName: "Aave V3",
        riskStatus: "available",
      },
    });
    expect(
      result.projection.financials.projectedCollateralUsd.toString(10)
    ).toBe("3000");
    expect(result.projection.financials.projectedDebtUsd.toString(10)).toBe(
      "425"
    );
  });

  it("assesses and reviews fee-bearing collateral at its effective amount", () => {
    const feeMarket = {
      ...market,
      collateralTokens: [
        {
          ...collateralToken,
          priceUsd: new BigNumber(1),
          token: { ...collateralToken.token, decimals: 2 },
        },
      ],
      supplyCollateralFeeBps: 500,
    };
    const emptySnapshot = {
      ...accountSnapshot,
      availableToBorrowUsd: new BigNumber(0),
      currentLtv: new BigNumber(0),
      debtBalances: [],
      healthFactor: null,
      netWorthUsd: new BigNumber(0),
      supplyBalances: [],
      totalBorrowedUsd: new BigNumber(0),
      totalCollateralUsd: new BigNumber(0),
      totalSuppliedUsd: new BigNumber(0),
    };
    const feePositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        { accountSnapshot: emptySnapshot, integration },
      ],
      markets: [feeMarket],
    });
    const feeTokenBalances = Schema.decodeUnknownSync(TokenBalancesResponse)([
      {
        amount: "100",
        availableYields: [],
        token: {
          address: collateralTokenAddress,
          decimals: 2,
          name: "Wrapped Ether",
          network: "ethereum",
          symbol: "WETH",
        },
      },
    ]);

    const warned = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber(78),
      collateralAmount: new BigNumber(100),
      collateralToken: feeMarket.collateralTokens[0]!,
      integrations: [integration],
      market: feeMarket,
      positions: feePositions,
      tokenBalances: feeTokenBalances,
    });

    expect(warned).toMatchObject({
      _tag: "Ready",
      projection: {
        collateralUsd: new BigNumber(95),
        financials: { projectedCollateralUsd: new BigNumber(95) },
      },
      warnings: ["RiskCapacityExceeded"],
    });

    const ready = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber(75),
      collateralAmount: new BigNumber(100),
      collateralToken: feeMarket.collateralTokens[0]!,
      integrations: [integration],
      market: feeMarket,
      positions: feePositions,
      tokenBalances: feeTokenBalances,
    });

    expect(ready).toMatchObject({
      _tag: "Ready",
      review: {
        command: { args: { collateralAmount: "100" } },
        summary: {
          collateralAmount: "100",
          collateralFeeAmount: "5",
          effectiveCollateralAmount: "95",
          projectedCollateralUsd: "95",
        },
      },
    });

    const supply = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber(0),
      collateralAmount: new BigNumber("1.234"),
      collateralToken: feeMarket.collateralTokens[0]!,
      integrations: [integration],
      market: feeMarket,
      positions: feePositions,
      tokenBalances: feeTokenBalances,
    });

    expect(supply).toMatchObject({
      _tag: "Ready",
      review: {
        command: { args: { amount: "1.23" } },
        summary: {
          action: "supply",
          collateralAmount: "1.23",
          collateralFeeAmount: "0.06",
          effectiveCollateralAmount: "1.17",
        },
      },
    });
  });

  it.each([
    {
      borrowAmount: "25",
      collateralAmount: "0",
      expectedAction: "borrow",
      expectedStatus: "Ready",
    },
    {
      borrowAmount: "0",
      collateralAmount: "1",
      expectedAction: "supply",
      expectedStatus: "Ready",
    },
    {
      borrowAmount: "0",
      collateralAmount: "0",
      expectedAction: null,
      expectedStatus: "Idle",
    },
  ] as const)(
    "prepares normalized open-position draft $expectedAction as $expectedStatus",
    ({ borrowAmount, collateralAmount, expectedAction, expectedStatus }) => {
      const result = prepareBorrowAction({
        _tag: "OpenPositionDraft",
        address,
        borrowAmount: new BigNumber(borrowAmount),
        collateralAmount: new BigNumber(collateralAmount),
        collateralToken,
        integrations: [integration],
        market,
        positions,
        tokenBalances,
      });

      expect(result._tag).toBe(expectedStatus);
      expect(
        result._tag === "Ready" ? result.review.summary.action : null
      ).toBe(expectedAction);
    }
  );

  it("returns every applicable semantic warning with a review", () => {
    const result = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber("500001"),
      collateralAmount: new BigNumber(3),
      collateralToken,
      integrations: [integration],
      market,
      positions,
      tokenBalances,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      warnings: [
        "AmountExceedsAvailableLiquidity",
        "AmountExceedsWalletBalance",
        "RiskCapacityExceeded",
      ],
    });
    expect("review" in result).toBe(true);
  });

  it("warns for an exact Action Command amount above known risk capacity", () => {
    const precisionMarket = {
      ...market,
      collateralTokens: [
        {
          ...collateralToken,
          liquidationThreshold: new BigNumber("0.1"),
          maxLtv: new BigNumber("0.1"),
          priceUsd: new BigNumber(1),
        },
      ],
    };
    const precisionSnapshot = {
      ...accountSnapshot,
      availableToBorrowUsd: new BigNumber("0.1"),
      currentLtv: new BigNumber(0),
      debtBalances: [],
      healthFactor: null,
      supplyBalances: [
        {
          ...accountSnapshot.supplyBalances[0]!,
          balance: new BigNumber(1),
          balanceRaw: 1_000_000_000_000_000_000n,
          balanceUsd: new BigNumber(1),
          marketId: precisionMarket.id,
        },
      ],
      totalBorrowedUsd: new BigNumber(0),
      totalCollateralUsd: new BigNumber(1),
      totalSuppliedUsd: new BigNumber(1),
    };
    const precisionPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        { accountSnapshot: precisionSnapshot, integration },
      ],
      markets: [precisionMarket],
    });

    const result = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber("0.100001"),
      collateralAmount: new BigNumber(0),
      collateralToken: precisionMarket.collateralTokens[0]!,
      integrations: [integration],
      market: precisionMarket,
      positions: precisionPositions,
      tokenBalances,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      warnings: ["RiskCapacityExceeded"],
    });
  });

  it("warns when new debt is below the market minimum", () => {
    const minimumMarket = { ...market, minLoan: new BigNumber(10) };
    const result = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber("9.99"),
      collateralAmount: new BigNumber(1),
      collateralToken: minimumMarket.collateralTokens[0]!,
      integrations: [integration],
      market: minimumMarket,
      positions: emptyBorrowPositions,
      tokenBalances,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      warnings: ["ProjectedDebtBelowMarketMinimum"],
    });
  });

  it("keeps Risk Unavailable internal and nonblocking", () => {
    const unavailableSnapshot = {
      ...accountSnapshot,
      supplyBalances: accountSnapshot.supplyBalances.map((balance) => ({
        ...balance,
        balanceUsd: new BigNumber(0),
      })),
      totalCollateralUsd: new BigNumber(0),
      totalSuppliedUsd: new BigNumber(0),
    };
    const unavailablePositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        { accountSnapshot: unavailableSnapshot, integration },
      ],
      markets: [market],
    });
    const result = prepareBorrowAction({
      _tag: "OpenPositionDraft",
      address,
      borrowAmount: new BigNumber(25),
      collateralAmount: new BigNumber(0),
      collateralToken,
      integrations: [integration],
      market,
      positions: unavailablePositions,
      tokenBalances,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      projection: {
        risk: { status: "unavailable" },
      },
      review: {
        summary: { riskStatus: "unavailable" },
      },
    });
  });

  it("uses the effective repayment amount for both command and review", () => {
    const result = prepareBorrowAction({
      _tag: "RepayDraft",
      address,
      amount: new BigNumber(100),
      context: {
        action: repayAction,
        debtBalance,
        position,
        type: "repay",
      },
      repayAll: false,
      tokenBalances: Schema.decodeUnknownSync(TokenBalancesResponse)([
        {
          amount: "150",
          availableYields: [],
          token: {
            address: loanTokenAddress,
            decimals: 6,
            name: "USD Coin",
            network: "ethereum",
            symbol: "USDC",
          },
        },
      ]),
    });

    expect(result._tag).toBe("Ready");
    if (result._tag !== "Ready") {
      return;
    }

    expect(result.review).toMatchObject({
      command: {
        action: "repay",
        args: {
          amount: "100",
          marketId: market.id,
        },
      },
      summary: {
        action: "repay",
        borrowAmount: "100",
        existingDebtUsd: "400",
        loanTokenSymbol: "USDC",
        projectedDebtUsd: "300",
        riskStatus: "available",
      },
    });
    expect(result.projection.remainingDebt.toString(10)).toBe("300");
  });

  it("keeps a pooled repayment Debt transition market-local", () => {
    const daiTokenAddress = Schema.decodeSync(TokenAddress)(
      "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    );
    const daiMarket = {
      ...market,
      id: Schema.decodeSync(MarketId)("aave-v3-ethereum-dai"),
      loanToken: {
        ...market.loanToken,
        address: daiTokenAddress,
        name: "Dai",
        symbol: "DAI",
      },
    };
    const multiMarketSnapshot = {
      ...accountSnapshot,
      availableToBorrowUsd: new BigNumber(0),
      currentLtv: new BigNumber(1),
      debtBalances: [
        ...accountSnapshot.debtBalances,
        {
          ...accountSnapshot.debtBalances[0]!,
          balance: new BigNumber(600),
          balanceRaw: 600_000_000n,
          balanceUsd: new BigNumber(600),
          marketId: daiMarket.id,
          pendingActions: [],
          tokenAddress: daiTokenAddress,
          tokenSymbol: "DAI",
        },
      ],
      healthFactor: new BigNumber("0.85"),
      netWorthUsd: new BigNumber(0),
      totalBorrowedUsd: new BigNumber(1000),
    };
    const multiMarketPositions = deriveBorrowPositions({
      integrationAccountSnapshots: [
        { accountSnapshot: multiMarketSnapshot, integration },
      ],
      markets: [market, daiMarket],
    });
    const selectedPosition = multiMarketPositions.items.find(
      (candidate) => candidate.id === market.id
    );
    const selectedDebt = selectedPosition?.balances.debt;
    const selectedRepay = selectedPosition?.actions.debt.find(
      (action) => action.type === "repay"
    );
    if (!selectedPosition || !selectedDebt || !selectedRepay) {
      throw new Error("Expected pooled repayment context");
    }

    const result = prepareBorrowAction({
      _tag: "RepayDraft",
      address,
      amount: new BigNumber(100),
      context: {
        action: selectedRepay,
        debtBalance: selectedDebt,
        position: selectedPosition,
        type: "repay",
      },
      repayAll: false,
      tokenBalances: null,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      review: {
        summary: {
          existingDebtUsd: "400",
          projectedDebtUsd: "300",
        },
      },
    });
  });

  it("repays all debt without inventing an amount in the Action Command", () => {
    const result = prepareBorrowAction({
      _tag: "RepayDraft",
      address,
      amount: new BigNumber(0),
      context: {
        action: repayAction,
        debtBalance,
        position,
        type: "repay",
      },
      repayAll: true,
      tokenBalances: null,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      review: {
        command: {
          args: { repayAll: true },
        },
        summary: {
          borrowAmount: "400",
          projectedDebtUsd: "0",
        },
      },
    });
    if (result._tag === "Ready") {
      expect(result.review.command.args.amount).toBeUndefined();
    }
  });

  it("preserves unavailable wallet-balance policy while warning on known limits", () => {
    const context = {
      action: repayAction,
      debtBalance,
      position,
      type: "repay" as const,
    };
    const unknownBalance = prepareBorrowAction({
      _tag: "RepayDraft",
      address,
      amount: new BigNumber(200),
      context,
      repayAll: false,
      tokenBalances: null,
    });
    const knownInsufficientBalance = prepareBorrowAction({
      _tag: "RepayDraft",
      address,
      amount: new BigNumber(200),
      context,
      repayAll: false,
      tokenBalances: Schema.decodeUnknownSync(TokenBalancesResponse)([
        {
          amount: "150",
          availableYields: [],
          token: {
            address: loanTokenAddress,
            decimals: 6,
            name: "USD Coin",
            network: "ethereum",
            symbol: "USDC",
          },
        },
      ]),
    });

    expect(unknownBalance._tag).toBe("Ready");
    expect(knownInsufficientBalance).toMatchObject({
      _tag: "Ready",
      warnings: ["AmountExceedsWalletBalance"],
    });
  });

  it("warns when repayment leaves debt below the market minimum", () => {
    const minimumMarket = { ...market, minLoan: new BigNumber(10) };
    const minimumPosition = deriveBorrowPositions({
      integrationAccountSnapshots: [{ accountSnapshot, integration }],
      markets: [minimumMarket],
    }).items[0]!;
    const minimumDebt = minimumPosition.balances.debt!;
    const minimumRepay = minimumPosition.actions.debt.find(
      (action) => action.type === "repay"
    )!;
    const result = prepareBorrowAction({
      _tag: "RepayDraft",
      address,
      amount: new BigNumber(395),
      context: {
        action: minimumRepay,
        debtBalance: minimumDebt,
        position: minimumPosition,
        type: "repay",
      },
      repayAll: false,
      tokenBalances: null,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      warnings: ["RemainingDebtBelowMarketMinimum"],
    });
  });

  it("creates a withdrawal command from the selected collateral exposure", () => {
    const result = prepareBorrowAction({
      _tag: "WithdrawDraft",
      address,
      amount: new BigNumber("0.1"),
      context: {
        position,
        tokens: [
          {
            action: withdrawAction,
            availableAmount: new BigNumber("0.5"),
            collateralToken,
            supplyBalance,
          },
        ],
        type: "withdraw",
      },
      token: {
        action: withdrawAction,
        availableAmount: new BigNumber("0.5"),
        collateralToken,
        supplyBalance,
      },
    });

    expect(result._tag).toBe("Ready");
    if (result._tag !== "Ready") {
      return;
    }

    expect(result.review).toMatchObject({
      command: {
        action: "withdraw",
        args: {
          amount: "0.1",
          marketId: market.id,
          tokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        },
      },
      summary: {
        action: "withdraw",
        collateralAmount: "0.1",
        collateralTokenSymbol: "WETH",
        existingCollateralUsd: "1000",
        projectedCollateralUsd: "800",
        riskStatus: "available",
      },
    });
  });

  it("preserves an exact Withdraw Max amount through review", () => {
    const availableAmount = new BigNumber("0.123456789012345678");
    const preciseSupplyBalance = {
      ...supplyBalance,
      balance: availableAmount,
      balanceRaw: 123_456_789_012_345_678n,
    };
    const token = {
      action: withdrawAction,
      availableAmount,
      collateralToken,
      supplyBalance: preciseSupplyBalance,
    };
    const context = {
      position,
      tokens: [token],
      type: "withdraw" as const,
    };
    const exact = prepareBorrowAction({
      _tag: "WithdrawDraft",
      address,
      amount: availableAmount,
      context,
      token,
    });
    const above = prepareBorrowAction({
      _tag: "WithdrawDraft",
      address,
      amount: availableAmount.plus("0.000000000000000001"),
      context,
      token,
    });

    expect(exact).toMatchObject({
      _tag: "Ready",
      review: {
        command: {
          args: { amount: "0.123456789012345678" },
        },
        summary: {
          collateralAmount: "0.123456789012345678",
        },
      },
    });
    expect(above).toMatchObject({
      _tag: "Ready",
      warnings: ["AmountExceedsPositionBalance"],
    });
  });

  it("reports both balance and Risk Position withdrawal warnings", () => {
    const token = {
      action: withdrawAction,
      availableAmount: new BigNumber("0.5"),
      collateralToken,
      supplyBalance,
    };
    const result = prepareBorrowAction({
      _tag: "WithdrawDraft",
      address,
      amount: new BigNumber(1),
      context: {
        position,
        tokens: [token],
        type: "withdraw",
      },
      token,
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      warnings: ["AmountExceedsPositionBalance", "RiskCapacityExceeded"],
    });
  });

  it("warns on a collateral toggle when Risk Position rejects it", () => {
    const result = prepareBorrowAction({
      _tag: "CollateralToggleIntent",
      address,
      context: {
        action: disableCollateralAction,
        position,
        supplyBalance,
        type: "disableCollateral",
      },
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      warnings: ["RiskCapacityExceeded"],
    });
    expect("review" in result).toBe(true);
  });

  it("creates a collateral-toggle review when Risk Position allows it", () => {
    const debtFreeSnapshot = {
      ...accountSnapshot,
      availableToBorrowUsd: new BigNumber(800),
      currentLtv: new BigNumber(0),
      debtBalances: [],
      healthFactor: null,
      netApy: new BigNumber("0.02"),
      netWorthUsd: new BigNumber(1000),
      totalBorrowedUsd: new BigNumber(0),
    };
    const debtFreePosition = deriveBorrowPositions({
      integrationAccountSnapshots: [
        { accountSnapshot: debtFreeSnapshot, integration },
      ],
      markets: [market],
    }).items[0]!;
    const debtFreeBalance = debtFreePosition.balances.supply[0]!;
    const debtFreeToggle = debtFreePosition.actions.supply.find(
      (action) => action.type === "disableCollateral"
    )!;
    const result = prepareBorrowAction({
      _tag: "CollateralToggleIntent",
      address,
      context: {
        action: debtFreeToggle,
        position: debtFreePosition,
        supplyBalance: debtFreeBalance,
        type: "disableCollateral",
      },
    });

    expect(result).toMatchObject({
      _tag: "Ready",
      review: {
        command: {
          action: "disableCollateral",
          args: {
            marketId: market.id,
            tokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
          },
        },
        summary: {
          action: "disableCollateral",
          collateralTokenSymbol: "WETH",
          existingCollateralUsd: "1000",
          riskStatus: "available",
        },
      },
    });
  });
});
