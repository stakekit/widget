import type { ActionCommand } from "../../../domain/borrow/execution/action-command";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import type { WalletScopeKey } from "../../../domain/wallet/wallet-scope";
import {
  toWidgetPath,
  type WidgetPathInput,
} from "../../../services/navigation/widget-navigation";

export type BorrowConstraintWarning =
  | "AmountExceedsAvailableLiquidity"
  | "AmountExceedsPositionBalance"
  | "AmountExceedsWalletBalance"
  | "ProjectedDebtBelowMarketMinimum"
  | "RemainingDebtBelowMarketMinimum"
  | "RiskCapacityExceeded";

type BorrowReviewCommon = {
  readonly marketLabel: string;
  readonly network: BorrowNetwork;
  readonly providerName: string;
  readonly warnings: ReadonlyArray<BorrowConstraintWarning>;
};

type AvailableBorrowReviewRisk = {
  readonly projectedHealthFactor?: string;
  readonly projectedLtv: string;
  readonly riskStatus: "available";
};

type UnavailableBorrowReviewRisk = {
  readonly riskStatus: "unavailable";
};

type BorrowReviewRisk = AvailableBorrowReviewRisk | UnavailableBorrowReviewRisk;

type OpenPositionReviewFinancials = {
  readonly existingCollateralUsd: string;
  readonly existingDebtUsd: string;
  readonly projectedCollateralUsd: string;
  readonly projectedDebtUsd: string;
};

type BorrowTransactionFlowSummary = BorrowReviewCommon &
  BorrowReviewRisk &
  (
    | (OpenPositionReviewFinancials & {
        readonly action: "borrow";
        readonly borrowAmount: string;
        readonly loanTokenSymbol: string;
      })
    | (OpenPositionReviewFinancials & {
        readonly action: "borrowAndSupply";
        readonly borrowAmount: string;
        readonly collateralAmount: string;
        readonly collateralFeeAmount: string;
        readonly collateralTokenSymbol: string;
        readonly effectiveCollateralAmount: string;
        readonly loanTokenSymbol: string;
      })
    | (OpenPositionReviewFinancials & {
        readonly action: "supply";
        readonly collateralAmount: string;
        readonly collateralFeeAmount: string;
        readonly collateralTokenSymbol: string;
        readonly effectiveCollateralAmount: string;
      })
    | {
        readonly action: "repay";
        readonly borrowAmount: string;
        readonly existingDebtUsd: string;
        readonly loanTokenSymbol: string;
        readonly projectedDebtUsd: string;
      }
    | {
        readonly action: "withdraw";
        readonly collateralAmount: string;
        readonly collateralTokenSymbol: string;
        readonly existingCollateralUsd: string;
        readonly projectedCollateralUsd: string;
      }
    | {
        readonly action: "disableCollateral" | "enableCollateral";
        readonly collateralTokenSymbol: string;
        readonly existingCollateralUsd: string;
      }
  );

export type BorrowTransactionFlowReview = {
  readonly command: ActionCommand;
  readonly summary: BorrowTransactionFlowSummary;
};

export const getBorrowTransactionFlowAmountLabelKey = (
  action: BorrowTransactionFlowSummary["action"]
) =>
  action === "repay"
    ? ("dashboard.borrow.review_page.repay_amount" as const)
    : ("dashboard.borrow.review_page.borrow_amount" as const);

export const projectBorrowTransactionFlowSummary = (
  summary: BorrowTransactionFlowSummary
) => {
  const risk =
    summary.riskStatus === "available"
      ? {
          projectedHealthFactor: summary.projectedHealthFactor ?? null,
          projectedLtv: summary.projectedLtv,
          status: summary.riskStatus,
        }
      : {
          projectedHealthFactor: null,
          projectedLtv: null,
          status: summary.riskStatus,
        };

  switch (summary.action) {
    case "borrow":
      return {
        borrow: {
          amount: summary.borrowAmount,
          symbol: summary.loanTokenSymbol,
        },
        collateral: null,
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: summary.existingDebtUsd,
          projectedCollateralUsd: summary.projectedCollateralUsd,
          projectedDebtUsd: summary.projectedDebtUsd,
        },
        risk,
      };
    case "borrowAndSupply":
      return {
        borrow: {
          amount: summary.borrowAmount,
          symbol: summary.loanTokenSymbol,
        },
        collateral: {
          amount: summary.collateralAmount,
          effectiveAmount: summary.effectiveCollateralAmount,
          feeAmount: summary.collateralFeeAmount,
          symbol: summary.collateralTokenSymbol,
        },
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: summary.existingDebtUsd,
          projectedCollateralUsd: summary.projectedCollateralUsd,
          projectedDebtUsd: summary.projectedDebtUsd,
        },
        risk,
      };
    case "supply":
      return {
        borrow: null,
        collateral: {
          amount: summary.collateralAmount,
          effectiveAmount: summary.effectiveCollateralAmount,
          feeAmount: summary.collateralFeeAmount,
          symbol: summary.collateralTokenSymbol,
        },
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: summary.existingDebtUsd,
          projectedCollateralUsd: summary.projectedCollateralUsd,
          projectedDebtUsd: summary.projectedDebtUsd,
        },
        risk,
      };
    case "repay":
      return {
        borrow: {
          amount: summary.borrowAmount,
          symbol: summary.loanTokenSymbol,
        },
        collateral: null,
        financials: {
          existingCollateralUsd: null,
          existingDebtUsd: summary.existingDebtUsd,
          projectedCollateralUsd: null,
          projectedDebtUsd: summary.projectedDebtUsd,
        },
        risk,
      };
    case "withdraw":
      return {
        borrow: null,
        collateral: {
          amount: summary.collateralAmount,
          symbol: summary.collateralTokenSymbol,
        },
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: null,
          projectedCollateralUsd: summary.projectedCollateralUsd,
          projectedDebtUsd: null,
        },
        risk,
      };
    case "disableCollateral":
    case "enableCollateral":
      return {
        borrow: null,
        collateral: null,
        financials: {
          existingCollateralUsd: summary.existingCollateralUsd,
          existingDebtUsd: null,
          projectedCollateralUsd: null,
          projectedDebtUsd: null,
        },
        risk,
      };
  }
};

export type BorrowTransactionFlowEntry =
  | { readonly _tag: "BorrowEntry" }
  | { readonly _tag: "MarketPosition"; readonly marketId: string };

export type BorrowTransactionFlowIntake = BorrowTransactionFlowReview & {
  readonly entry: BorrowTransactionFlowEntry;
};

export type BorrowFlowSession = Readonly<{
  readonly epoch: number;
  readonly intake: BorrowTransactionFlowIntake;
  readonly walletScope: WalletScopeKey;
}>;

export const getBorrowReviewTrackingProperties = (
  intake: BorrowTransactionFlowIntake
) => {
  if (intake.entry._tag !== "BorrowEntry") return null;
  const { command, summary } = intake;
  return {
    borrowAmount: "borrowAmount" in summary ? summary.borrowAmount : "0",
    collateralAmount:
      "collateralAmount" in summary ? summary.collateralAmount : "0",
    collateralTokenAddress: command.args.collateralTokenAddress,
    collateralTokenSymbol:
      "collateralTokenSymbol" in summary
        ? summary.collateralTokenSymbol
        : undefined,
    marketId: command.args.marketId,
  };
};

export const getBorrowTransactionFlowRoutes = (
  entry: BorrowTransactionFlowEntry
) => {
  const basePath: WidgetPathInput =
    entry._tag === "BorrowEntry"
      ? "/borrow"
      : `/positions/borrow/${entry.marketId}`;

  return {
    basePath: toWidgetPath(basePath),
    completePath: toWidgetPath(`${basePath}/complete`),
    reviewPath: toWidgetPath(`${basePath}/review`),
    stepsPath: toWidgetPath(`${basePath}/steps`),
  } as const;
};
