import type { ActionRequest } from "../../../domain/borrow/action-request";
import type { BorrowNetwork } from "../../../domain/borrow/network";
import {
  toWidgetPath,
  type WidgetPathInput,
} from "../../../services/navigation/widget-navigation";

export type BorrowTransactionFlowReview = {
  readonly request: ActionRequest;
  readonly summary: {
    readonly action:
      | "borrow"
      | "borrowAndSupply"
      | "disableCollateral"
      | "enableCollateral"
      | "repay"
      | "supply"
      | "withdraw";
    readonly borrowAmount?: string;
    readonly collateralAmount?: string;
    readonly collateralTokenSymbol?: string;
    readonly existingCollateralUsd?: string;
    readonly existingDebtUsd?: string;
    readonly loanTokenSymbol?: string;
    readonly marketLabel: string;
    readonly network: BorrowNetwork;
    readonly projectedCollateralUsd?: string;
    readonly projectedDebtUsd?: string;
    readonly projectedHealthFactor?: string;
    readonly projectedLtv?: string;
    readonly providerName: string;
    readonly riskStatus?: "available" | "unavailable";
  };
};

export type BorrowTransactionFlowEntry =
  | { readonly _tag: "BorrowDashboard" }
  | { readonly _tag: "BorrowPosition"; readonly marketId: string };

export type BorrowTransactionFlowIntake = BorrowTransactionFlowReview & {
  readonly entry: BorrowTransactionFlowEntry;
};

export const getBorrowTransactionFlowRoutes = (
  entry: BorrowTransactionFlowEntry
) => {
  const basePath: WidgetPathInput =
    entry._tag === "BorrowDashboard"
      ? "/borrow"
      : `/positions/borrow/${entry.marketId}`;

  return {
    basePath: toWidgetPath(basePath),
    completePath: toWidgetPath(`${basePath}/complete`),
    reviewPath: toWidgetPath(`${basePath}/review`),
    stepsPath: toWidgetPath(`${basePath}/steps`),
  } as const;
};
