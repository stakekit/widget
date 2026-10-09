import type BigNumber from "bignumber.js";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { formatPercent } from "../../../../../shared/lib/formatters";
import { DetailRow } from "../../../../../shared/ui/components/details-section";

export const LtvTransitionRow = ({
  currentLtv,
  projectedLtv,
}: {
  readonly currentLtv: BigNumber | null;
  readonly projectedLtv: BigNumber | null;
}): ReactElement | null => {
  const { t } = useTranslation();

  if (projectedLtv === null) return null;

  const value =
    currentLtv === null
      ? formatPercent(projectedLtv)
      : `${formatPercent(currentLtv)} -> ${formatPercent(projectedLtv)}`;

  return (
    <DetailRow
      id="ltv"
      label={t("dashboard.borrow.form.ltv_ratio")}
      value={value}
    />
  );
};
