import { useTranslation } from "react-i18next";

import { Button, Notice } from "../../../../../ui/index";
import type {
  BorrowPositionAction,
  BorrowPositionRiskAlert,
} from "../../model/details";

/**
 * A position close to liquidation: the alert in its band's tone, and Repay,
 * the way out the position offers. Adding collateral to an open position is
 * not an action the Borrow API offers, so Repay is the only one.
 */
export const BorrowPositionRiskAlertNotice = ({
  actions,
  alert,
  onRepay,
}: {
  readonly actions: ReadonlyArray<BorrowPositionAction>;
  readonly alert: BorrowPositionRiskAlert;
  /** Takes the user to repaying: the page chooses Repay and its amount. */
  readonly onRepay: (repay: BorrowPositionAction) => void;
}) => {
  const { t } = useTranslation();
  const repay = actions.find((action) => action.type === "repay");

  return (
    <Notice
      tone={alert.tone}
      title={alert.title}
      testId="borrow-position-risk-alert"
      action={
        repay === undefined ? undefined : (
          <Button size="sm" variant="primary" onClick={() => onRepay(repay)}>
            {t("dashboard.borrow.position_details.actions.repay")}
          </Button>
        )
      }
    >
      {alert.body}
    </Notice>
  );
};
