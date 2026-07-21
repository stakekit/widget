import type { ActionRequest } from "../../../domain/borrow/action-request";
import type { BorrowNetwork } from "../../../domain/borrow/network";

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
  const basePath =
    entry._tag === "BorrowDashboard"
      ? "/borrow"
      : `/positions/borrow/${entry.marketId}`;

  return {
    basePath,
    completePath: `${basePath}/complete`,
    reviewPath: `${basePath}/review`,
    stepsPath: `${basePath}/steps`,
  } as const;
};
