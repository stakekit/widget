import type { TFunction } from "i18next";

import type { BorrowPositionActionFormWarning } from "../../model/action-form";

const warningTranslationKeys = {
  repayDebt: "borrow.position_details.validation.repay_debt",
  repayMinimum: "borrow.position_details.validation.repay_minimum",
  walletBalance: "borrow.position_details.validation.wallet_balance",
  withdrawBalance: "borrow.position_details.validation.withdraw_balance",
  withdrawLtv: "borrow.position_details.validation.withdraw_ltv",
} as const satisfies Record<BorrowPositionActionFormWarning, string>;

export const getBorrowPositionFormWarningMessage = ({
  warning,
  t,
}: {
  readonly warning: BorrowPositionActionFormWarning | null;
  readonly t: TFunction;
}) => (warning ? t(warningTranslationKeys[warning]) : null);
