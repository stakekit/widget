import type BigNumber from "bignumber.js";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { formatLtv } from "../../../../../shared/lib/number-format";
import { DetailRow } from "../../../../../shared/ui/components/details-section";
import { useWidgetPresentation } from "../../../../../shared/ui/widget-presentation";

export const LtvTransitionRow = ({
  currentLtv,
  projectedLtv,
}: {
  readonly currentLtv: BigNumber | null;
  readonly projectedLtv: BigNumber | null;
}): ReactElement | null => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (projectedLtv === null) return null;

  const value =
    currentLtv === null
      ? formatLtv(projectedLtv, locale)
      : `${formatLtv(currentLtv, locale)} -> ${formatLtv(projectedLtv, locale)}`;

  return (
    <DetailRow
      id="ltv"
      label={t("dashboard.borrow.form.ltv_ratio")}
      value={value}
    />
  );
};
