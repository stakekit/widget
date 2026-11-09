import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import type { RiskBand } from "../../../../../domain/borrow/risk/risk-band";
import {
  formatLtv,
  formatPercent,
  toChartNumber,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { Meter } from "../../../../../ui/index";
import { riskBandMeterTone } from "../../../../borrow-transaction-flow/index";

/**
 * Loan to value on a 0–100% scale, with the liquidation threshold marked,
 * in the position's risk band.
 */
export const LtvGauge = ({
  currentLtv,
  liquidationThreshold,
  riskBand,
}: {
  readonly currentLtv: BigNumber | null;
  readonly liquidationThreshold: BigNumber | null;
  readonly riskBand: RiskBand | null;
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
      valueText={formatLtv(currentLtv, locale)}
      tone={riskBand === null ? "accent" : riskBandMeterTone[riskBand]}
      scale={{
        start: t("dashboard.borrow.position_details.low_risk"),
        end: liquidationLabel,
      }}
      marker={
        liquidationThreshold == null || liquidationLabel === undefined
          ? undefined
          : {
              value: toChartNumber(liquidationThreshold.multipliedBy(100)),
              label: liquidationLabel,
            }
      }
    />
  );
};
