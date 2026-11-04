import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import { classifyLtv } from "../../../../../domain/borrow/risk/ltv-limits";
import {
  formatPercent,
  toChartNumber,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { Meter } from "../../../../../ui/index";

const riskLevelTone = {
  nearLimit: "warning",
  overLimit: "danger",
  safe: "accent",
} as const;

/** Loan to value on a 0–100% scale, with the liquidation threshold marked. */
export const LtvGauge = ({
  currentLtv,
  liquidationThreshold,
  maxLtv,
}: {
  readonly currentLtv: BigNumber | null;
  readonly liquidationThreshold: BigNumber | null;
  readonly maxLtv: BigNumber | null;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (currentLtv == null) {
    return null;
  }

  const liquidationLabel =
    liquidationThreshold == null
      ? undefined
      : t("dashboard.borrow.position_details.liquidation_at", {
          value: formatPercent(liquidationThreshold, locale),
        });

  return (
    <Meter
      label={t("dashboard.borrow.position_details.loan_to_value")}
      value={Math.min(100, toChartNumber(currentLtv.multipliedBy(100)))}
      valueText={formatPercent(currentLtv, locale)}
      tone={riskLevelTone[classifyLtv({ ltv: currentLtv, maxLtv })]}
      scale={{
        start: t("dashboard.borrow.position_details.low_risk"),
        ...(liquidationLabel === undefined ? {} : { end: liquidationLabel }),
      }}
      {...(liquidationThreshold == null || liquidationLabel === undefined
        ? {}
        : {
            marker: {
              value: toChartNumber(liquidationThreshold.multipliedBy(100)),
              label: liquidationLabel,
            },
          })}
    />
  );
};
