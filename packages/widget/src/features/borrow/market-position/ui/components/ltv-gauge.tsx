import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";

import type { RiskBand } from "../../../../../domain/borrow/risk-band";
import { toRepresentationNumber } from "../../../../../domain/finance/exact";
import { formatPercent } from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { Meter } from "../../../../../ui/index";
import { formatLtv } from "../../../../borrow-presentation/index";
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
      : t("borrow.position_details.liquidation_at", {
          value: formatPercent(liquidationThreshold, locale),
        });

  return (
    <Meter
      label={t("borrow.position_details.loan_to_value")}
      value={Math.min(
        100,
        toRepresentationNumber(currentLtv.multipliedBy(100))
      )}
      valueText={formatLtv(currentLtv, locale)}
      tone={riskBand === null ? "accent" : riskBandMeterTone[riskBand]}
      scale={{
        start: t("borrow.position_details.low_risk"),
        end: liquidationLabel,
      }}
      marker={
        liquidationThreshold == null || liquidationLabel === undefined
          ? undefined
          : {
              value: toRepresentationNumber(
                liquidationThreshold.multipliedBy(100)
              ),
              label: liquidationLabel,
            }
      }
    />
  );
};
