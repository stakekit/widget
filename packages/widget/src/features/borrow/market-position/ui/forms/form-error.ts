import type { TFunction } from "i18next";
import type { BorrowPositionActionFormError } from "../../model/action-form";

const errorTranslationKeys = {
  repayDebt: "dashboard.borrow.position_details.validation.repay_debt",
  repayMinimum: "dashboard.borrow.position_details.validation.repay_minimum",
  walletBalance: "dashboard.borrow.position_details.validation.wallet_balance",
  withdrawBalance:
    "dashboard.borrow.position_details.validation.withdraw_balance",
  withdrawLtv: "dashboard.borrow.position_details.validation.withdraw_ltv",
} as const satisfies Record<BorrowPositionActionFormError, string>;

export const getBorrowPositionFormErrorMessage = ({
  error,
  t,
}: {
  readonly error: BorrowPositionActionFormError | null;
  readonly t: TFunction;
}) => (error ? t(errorTranslationKeys[error]) : null);
