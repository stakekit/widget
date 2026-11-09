import type BigNumber from "bignumber.js";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";

import {
  formatFigureChange,
  formatLtv,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { DetailRow } from "../../../../../ui/index";
import {
  riskValueTone,
  toLtvMeter,
} from "../../../../borrow-transaction-flow/index";
import type { BorrowActionFormRisk } from "../../model/action-form";

/**
 * The LTV before and after the action, in the band of the risk it leaves,
 * with a meter of the projected LTV.
 */
export const LtvTransitionRow = ({
  currentLtv,
  projectedLtv,
  projectedRisk,
}: {
  readonly currentLtv: BigNumber | null;
  readonly projectedLtv: BigNumber | null;
  readonly projectedRisk: BorrowActionFormRisk;
}): ReactElement | null => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const value = formatFigureChange(
    formatLtv,
    projectedLtv === null ? null : { before: currentLtv, after: projectedLtv },
    locale
  );
  if (value === null || projectedLtv === null) return null;

  return (
    <DetailRow
      label={t("dashboard.borrow.form.ltv_ratio")}
      value={value}
      tone={riskValueTone(projectedRisk.band)}
      {...(projectedRisk.band === null
        ? {}
        : {
            meter: toLtvMeter({
              locale,
              ltv: projectedLtv,
              maxLtv: projectedRisk.maxLtv,
              t,
            }),
          })}
    />
  );
};
