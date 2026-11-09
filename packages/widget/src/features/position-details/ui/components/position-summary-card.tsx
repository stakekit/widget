import { useTranslation } from "react-i18next";
import { PositionSummary } from "../../../../ui/index";
import { usePositionDetails } from "../../react/use-position-details";
import { usePositionOverview } from "../../react/use-position-overview";

/**
 * What the position is worth, leading its page under the header: the USD
 * value, its token amount and its reward rate, then what the wallet earned
 * over the last 7 days and all time when tracked, and the projected yearly
 * earnings.
 */
export const PositionSummaryCard = () => {
  const { t } = useTranslation();
  const { page } = usePositionDetails();
  const overview = usePositionOverview();
  const label = t("position_details.your_position");

  if (page._tag === "Loading") {
    return <PositionSummary label={label} value="" loading />;
  }
  if (!overview) return null;

  const { summary } = overview;

  return (
    <PositionSummary
      label={label}
      value={summary.value}
      subvalue={summary.subvalue}
      badge={summary.rate}
      rows={summary.rows}
      testId="position-summary"
    />
  );
};
