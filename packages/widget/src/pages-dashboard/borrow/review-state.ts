import type {
  Action,
  ActionRequest,
  BorrowExecutionResult,
} from "../../borrow";

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
    readonly network: string;
    readonly projectedCollateralUsd?: string;
    readonly projectedDebtUsd?: string;
    readonly projectedHealthFactor?: string;
    readonly projectedLtv?: string;
    readonly providerName: string;
  };
};

export type BorrowStepsState = BorrowReviewState & {
  readonly action: Action;
};

type BorrowCompleteState = BorrowStepsState & {
  readonly result: BorrowExecutionResult;
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

export const isBorrowStepsState = (
  value: unknown
): value is BorrowStepsState => {
  if (!isBorrowReviewState(value)) {
    return false;
  }

  const maybeState = value as Partial<BorrowStepsState>;

  return (
    !!maybeState.action &&
    typeof maybeState.action.id === "string" &&
    Array.isArray(maybeState.action.transactions)
  );
};

export const isBorrowCompleteState = (
  value: unknown
): value is BorrowCompleteState =>
  isBorrowStepsState(value) &&
  "result" in value &&
  !!(value as Partial<BorrowCompleteState>).result;
