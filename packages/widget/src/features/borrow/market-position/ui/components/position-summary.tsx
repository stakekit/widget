import { useTranslation } from "react-i18next";

import { PositionSummary } from "../../../../../ui/index";
import type { BorrowPositionDetailsModel } from "../../model/details";
import { LtvGauge } from "./ltv-gauge";

/**
 * What the position is worth: its net worth as the hero, its debt and health
 * factor beside it, and the loan to value gauge under them.
 */
export const BorrowPositionSummary = ({
  model,
}: {
  readonly model: BorrowPositionDetailsModel;
}) => {
  const { t } = useTranslation();

  return (
    <PositionSummary
      label={t("position_details.your_position")}
      value={model.summary.value}
      subvalue={model.summary.subvalue}
      metrics={model.summary.metrics}
      testId="borrow-position-summary"
    >
      <LtvGauge
        currentLtv={model.currentLtv}
        liquidationThreshold={model.liquidationThreshold}
        riskBand={model.riskBand}
      />
    </PositionSummary>
  );
};
