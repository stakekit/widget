import type { TFunction } from "i18next";
import type { BorrowPositionActionFormWarning } from "../../model/action-form";

const warningTranslationKeys = {
  repayDebt: "dashboard.borrow.position_details.validation.repay_debt",
  repayMinimum: "dashboard.borrow.position_details.validation.repay_minimum",
  walletBalance: "dashboard.borrow.position_details.validation.wallet_balance",
  withdrawBalance:
    "dashboard.borrow.position_details.validation.withdraw_balance",
  withdrawLtv: "dashboard.borrow.position_details.validation.withdraw_ltv",
} as const satisfies Record<BorrowPositionActionFormWarning, string>;

export const getBorrowPositionFormWarningMessage = ({
  warning,
  t,
}: {
  readonly warning: BorrowPositionActionFormWarning | null;
  readonly t: TFunction;
}) => (warning ? t(warningTranslationKeys[warning]) : null);
