import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { Action } from "../../src/domain/borrow/execution/action";
import {
  type BorrowTransactionFlowReview,
  projectBorrowTransactionFlowSummary,
} from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";

const summary: BorrowTransactionFlowReview["summary"] = {
  action: "borrowAndSupply",
  borrowAmount: "1",
  collateralAmount: "1",
  collateralFeeAmount: "0.05",
  collateralTokenSymbol: "WETH",
  debtPrincipalAmount: "1.005026",
  effectiveCollateralAmount: "0.95",
  existingCollateralUsd: "1000",
  existingDebtUsd: "400",
  loanTokenPriceUsd: "2",
  loanTokenSymbol: "USDC",
  marketLabel: "WETH / USDC",
  network: "base",
  originationFeeAmount: "0.005025",
  projectedCollateralUsd: "2900",
  projectedDebtUsd: "401.005026",
  providerName: "Morpho",
  riskStatus: "unavailable",
  warnings: [],
};

const decodeMetadata = (metadata: Record<string, unknown>) =>
  Schema.decodeSync(Action)({
    action: "borrow",
    address: "0x0000000000000000000000000000000000000001",
    createdAt: "2026-01-01T00:00:00.000Z",
    currentStep: 1,
    hasNextStep: false,
    id: "action-1",
    integrationId: "morpho-blue-borrow",
    metadata: {
      currentHealthFactor: null,
      currentLtv: "0",
      liquidationThreshold: "0.85",
      predictedHealthFactor: null,
      predictedLtv: "0",
      predictedTotalDebtUsd: "0",
      predictedTotalSupplyUsd: "0",
      ...metadata,
    },
    status: "CREATED",
    totalSteps: 1,
    transactions: [],
  }).metadata;

describe("Borrow Transaction Flow summary", () => {
  it("projects the estimated origination fee and gross debt principal", () => {
    expect(projectBorrowTransactionFlowSummary(summary)).toMatchObject({
      collateral: { effectiveAmount: "0.95", feeAmount: "0.05" },
      origination: {
        feeAmount: "0.005025",
        // 0.005025 USDC * 2 USD
        feeUsd: "0.01005",
        principalAmount: "1.005026",
        symbol: "USDC",
      },
    });
  });

  it("omits the origination rows when no fee applies", () => {
    expect(
      projectBorrowTransactionFlowSummary({
        ...summary,
        debtPrincipalAmount: "1",
        originationFeeAmount: "0",
      }).origination
    ).toBeNull();
  });

  it("omits the fee value in USD without a loan-token price", () => {
    expect(
      projectBorrowTransactionFlowSummary({
        ...summary,
        loanTokenPriceUsd: "0",
      }).origination
    ).toMatchObject({ feeAmount: "0.005025", feeUsd: null });
  });

  it("keeps created-action fee metadata and prefers it for display", () => {
    const metadata = decodeMetadata({
      effectiveCollateralAmount: "0.9",
      effectivePrincipalAmount: "1.006",
      feeAmount: "0.1",
      feeBps: 1000,
      originationFeeAmount: "0.006",
      originationFeeBps: 60,
    });

    expect(metadata).toMatchObject({ feeBps: 1000, originationFeeBps: 60 });
    expect(
      projectBorrowTransactionFlowSummary(summary, metadata)
    ).toMatchObject({
      collateral: { effectiveAmount: "0.9", feeAmount: "0.1" },
      origination: {
        feeAmount: "0.006",
        feeUsd: "0.012",
        principalAmount: "1.006",
      },
    });
  });

  it("derives effective collateral from a created-action collateral fee", () => {
    const metadata = decodeMetadata({ feeAmount: "0.02", feeBps: 200 });

    expect(
      projectBorrowTransactionFlowSummary(summary, metadata)
    ).toMatchObject({
      collateral: { effectiveAmount: "0.98", feeAmount: "0.02" },
      origination: { feeAmount: "0.005025", principalAmount: "1.005026" },
    });
  });

  it("uses a created-action zero origination fee over the estimate", () => {
    const metadata = decodeMetadata({
      effectivePrincipalAmount: "1",
      originationFeeAmount: "0",
      originationFeeBps: 0,
    });

    expect(
      projectBorrowTransactionFlowSummary(summary, metadata).origination
    ).toBeNull();
  });
});
