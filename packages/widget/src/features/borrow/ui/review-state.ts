import type { Action, ActionRequest, BorrowNetwork } from "../core";

export type BorrowReviewState = {
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

export type BorrowExecutionInput = BorrowReviewState & {
  readonly action: Action;
};

export const isBorrowReviewState = (
  value: unknown
): value is BorrowReviewState => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeState = value as Partial<BorrowReviewState>;

  return (
    !!maybeState.request &&
    !!maybeState.summary &&
    typeof maybeState.summary.marketLabel === "string" &&
    typeof maybeState.summary.providerName === "string"
  );
};
