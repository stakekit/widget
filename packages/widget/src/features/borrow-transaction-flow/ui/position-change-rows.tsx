import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  classifyHealthFactor,
  classifyLtv,
  type RiskLevel,
} from "../../../domain/borrow/risk/ltv-limits";
import { exactDecimal } from "../../../domain/finance/exact";
import {
  formatFigureChange,
  formatHealthFactor,
  formatLtv,
  formatUsd,
} from "../../../shared/lib/number-format";
import {
  DetailRow,
  type DetailRowTone,
} from "../../../shared/ui/components/details-section";
import { useWidgetPresentation } from "../../../shared/ui/widget-presentation";
import type { BorrowPositionChange } from "../model/borrow-completion";

const riskLevelTone = {
  nearLimit: "warning",
  overLimit: "danger",
  safe: "default",
} as const satisfies Record<RiskLevel, DetailRowTone>;

/** Collateral, debt, LTV, and health factor as they move with the action. */
export const BorrowFlowPositionChangeRows = ({
  change,
}: {
  readonly change: BorrowPositionChange;
}): ReactElement => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const collateral = formatFigureChange(
    formatUsd,
    change.collateralUsd,
    locale
  );
  const debt = formatFigureChange(formatUsd, change.debtUsd, locale);
  const ltv = formatFigureChange(formatLtv, change.ltv, locale);
  const healthFactor = formatFigureChange(
    formatHealthFactor,
    change.healthFactor,
    locale
  );

  return (
    <>
      {collateral ? (
        <DetailRow
          id="collateral-value"
          label={t("dashboard.borrow.form.collateral_value")}
          value={collateral}
        />
      ) : null}
      {debt ? (
        <DetailRow
          id="debt-value"
          label={t("dashboard.borrow.position_details.debt")}
          value={debt}
        />
      ) : null}
      {ltv && change.ltv ? (
        <DetailRow
          id="ltv"
          label={t("dashboard.borrow.review_page.ltv")}
          tone={
            riskLevelTone[
              classifyLtv({
                ltv: exactDecimal(change.ltv.after),
                maxLtv: change.maxLtv ? exactDecimal(change.maxLtv) : null,
              })
            ]
          }
          value={ltv}
        />
      ) : null}
      {healthFactor && change.healthFactor ? (
        <DetailRow
          id="health-factor"
          label={t("dashboard.borrow.review_page.health_factor")}
          tone={
            riskLevelTone[
              classifyHealthFactor(exactDecimal(change.healthFactor.after))
            ]
          }
          value={healthFactor}
        />
      ) : null}
    </>
  );
};
