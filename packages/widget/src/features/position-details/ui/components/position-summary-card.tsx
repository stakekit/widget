import { useTranslation } from "react-i18next";
import { PositionSummary } from "../../../../ui/index";
import { usePositionDetails } from "../../react/use-position-details";
import { usePositionOverview } from "../../react/use-position-overview";

/**
 * What the position is worth, leading its page under the header: the USD
 * value, its token amount, the reward rate, the estimated yearly earnings
 * and, when tracked, what the wallet earned over the last 7 days.
 */
export const PositionSummaryCard = () => {
  const { t } = useTranslation();
  const { isLoading } = usePositionDetails();
  const overview = usePositionOverview();
  const label = t("position_details.your_position");

  if (isLoading) {
    return <PositionSummary label={label} value="" metrics={[]} loading />;
  }
  if (!overview) return null;

  const { summary } = overview;

  return (
    <PositionSummary
      label={label}
      value={summary.value}
      {...(summary.subvalue === undefined
        ? {}
        : { subvalue: summary.subvalue })}
      metrics={summary.metrics}
      testId="position-summary"
    />
  );
};
