import type BigNumber from "bignumber.js";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import {
  formatFigureChange,
  formatLtv,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { DetailRow } from "../../../../../ui/index";

export const LtvTransitionRow = ({
  currentLtv,
  projectedLtv,
}: {
  readonly currentLtv: BigNumber | null;
  readonly projectedLtv: BigNumber | null;
}): ReactElement | null => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  const value = formatFigureChange(
    formatLtv,
    projectedLtv === null ? null : { before: currentLtv, after: projectedLtv },
    locale
  );
  if (value === null) return null;

  return (
    <DetailRow label={t("dashboard.borrow.form.ltv_ratio")} value={value} />
  );
};
