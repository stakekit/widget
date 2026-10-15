import { describe, expect, it } from "vitest";
import { projectBorrowCompletion } from "../../../src/features/borrow-transaction-flow/model/borrow-completion";
import type { BorrowTransactionFlowReview } from "../../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";

type Summary = BorrowTransactionFlowReview["summary"];

const common = {
  marketLabel: "WETH / USDC",
  network: "base",
  providerName: "Aave V3",
  warnings: [],
} as const;

const withdraw: Summary = {
  ...common,
  action: "withdraw",
  collateralAmount: "2",
  collateralTokenSymbol: "WETH",
  currentHealthFactor: "2.1",
  currentLtv: "0.4",
  existingCollateralUsd: "12.4",
  maxLtv: "0.8",
  projectedCollateralUsd: "10.4",
  projectedHealthFactor: "1.74",
  projectedLtv: "0.48",
  riskStatus: "available",
};

const borrowAndSupply: Summary = {
  ...common,
  action: "borrowAndSupply",
  borrowAmount: "25",
  collateralAmount: "0.5",
  collateralFeeAmount: "0.025",
  collateralTokenSymbol: "WETH",
  debtPrincipalAmount: "25",
  effectiveCollateralAmount: "0.475",
  existingCollateralUsd: "0",
  existingDebtUsd: "0",
  loanTokenPriceUsd: "1",
  loanTokenSymbol: "USDC",
  originationFeeAmount: "0",
  projectedCollateralUsd: "1500",
  projectedDebtUsd: "25",
  riskStatus: "unavailable",
};

describe("Borrow completion", () => {
  it("headlines the amount the action moved", () => {
    expect(projectBorrowCompletion({ summary: withdraw }).headline).toEqual({
      amount: "2",
      symbol: "WETH",
    });
    expect(
      projectBorrowCompletion({ summary: borrowAndSupply }).headline
    ).toEqual({ amount: "25", symbol: "USDC" });
    expect(
      projectBorrowCompletion({
        summary: {
          ...common,
          action: "enableCollateral",
          collateralTokenSymbol: "WETH",
          existingCollateralUsd: "100",
          riskStatus: "unavailable",
        },
      }).headline
    ).toEqual({ amount: null, symbol: "WETH" });
  });

  it("estimates the position from Review until the position settles", () => {
    expect(projectBorrowCompletion({ summary: withdraw }).position).toEqual({
      change: {
        collateralUsd: { after: "10.4", before: "12.4" },
        debtUsd: null,
        healthFactor: { after: "1.74", before: "2.1" },
        ltv: { after: "0.48", before: "0.4" },
        maxLtv: "0.8",
      },
      source: "estimated",
    });
  });

  it("reports the settled position against the figures Review started from", () => {
    expect(
      projectBorrowCompletion({
        settled: {
          collateralUsd: "10.38",
          debtUsd: "5",
          healthFactor: "1.73",
          ltv: "0.482",
          maxLtv: "0.75",
          positionOpen: true,
        },
        summary: withdraw,
      }).position
    ).toEqual({
      change: {
        collateralUsd: { after: "10.38", before: "12.4" },
        debtUsd: { after: "5", before: null },
        healthFactor: { after: "1.73", before: "2.1" },
        ltv: { after: "0.482", before: "0.4" },
        maxLtv: "0.75",
      },
      source: "settled",
    });
  });

  it("drops figures that stay at zero but keeps a figure that fell to zero", () => {
    expect(
      projectBorrowCompletion({
        settled: {
          collateralUsd: "0",
          debtUsd: "0",
          healthFactor: null,
          ltv: "0",
          maxLtv: null,
          positionOpen: false,
        },
        summary: {
          ...common,
          action: "repay",
          borrowAmount: "400",
          currentLtv: "0",
          existingDebtUsd: "400",
          loanTokenSymbol: "USDC",
          projectedDebtUsd: "0",
          projectedLtv: "0",
          riskStatus: "available",
        },
      }).position.change
    ).toEqual({
      collateralUsd: null,
      debtUsd: { after: "0", before: "400" },
      healthFactor: null,
      ltv: null,
      maxLtv: null,
    });
  });

  it("details supplied collateral and only a charged collateral fee", () => {
    expect(
      projectBorrowCompletion({ summary: borrowAndSupply }).details
    ).toEqual({
      collateralFee: { amount: "0.025", symbol: "WETH" },
      collateralSupplied: { amount: "0.5", symbol: "WETH" },
      origination: null,
    });
    expect(
      projectBorrowCompletion({
        summary: { ...borrowAndSupply, collateralFeeAmount: "0" },
      }).details.collateralFee
    ).toBeNull();
  });
});
