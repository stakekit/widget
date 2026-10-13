import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  classifyHealthFactor,
  classifyLtv,
  type RiskLevel,
} from "../../../domain/borrow/risk/ltv-limits";
import { exactDecimal } from "../../../domain/finance/exact";
import {
  formatHealthFactor,
  formatLtv,
  formatUsd,
} from "../../../shared/lib/formatters";
import {
  DetailRow,
  type DetailRowTone,
} from "../../../shared/ui/components/details-section";
import type { BorrowPositionChange } from "../model/borrow-completion";

const riskLevelTone = {
  nearLimit: "warning",
  overLimit: "danger",
  safe: "default",
} as const satisfies Record<RiskLevel, DetailRowTone>;

/** `-` is the formatters' unavailable marker; an unavailable figure shows nothing. */
const formatFigure = (
  format: (value: string) => string,
  value: string | null
) => {
  const formatted = value === null ? "-" : format(value);

  return formatted === "-" ? null : formatted;
};

const formatChange = (
  format: (value: string) => string,
  figure: { readonly after: string; readonly before: string | null } | null
) => {
  const after = figure && formatFigure(format, figure.after);
  if (!figure || !after) return null;
  const before = formatFigure(format, figure.before);

  return before && before !== after ? `${before} → ${after}` : after;
};

/** Collateral, debt, LTV, and health factor as they move with the action. */
export const BorrowFlowPositionChangeRows = ({
  change,
}: {
  readonly change: BorrowPositionChange;
}): ReactElement => {
  const { t } = useTranslation();
  const collateral = formatChange(formatUsd, change.collateralUsd);
  const debt = formatChange(formatUsd, change.debtUsd);
  const ltv = formatChange(formatLtv, change.ltv);
  const healthFactor = formatChange(formatHealthFactor, change.healthFactor);

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
