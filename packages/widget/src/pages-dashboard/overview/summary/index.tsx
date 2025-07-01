import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { SummaryItem } from "../../../components/molecules/summary-item";
import { summaryContainer } from "../../../components/molecules/summary-item/index.css";
import { useSummary } from "../../../hooks/use-summary";
import { useSettings } from "../../../providers/settings";
import { combineRecipeWithVariant } from "../../../utils/styles";

export const Summary = () => {
  const { allPositionsQuery, rewardsPositionsQuery, availableBalanceSumQuery } =
    useSummary();

  const { t } = useTranslation();

  const { variant } = useSettings();

  return (
    <Box
      className={combineRecipeWithVariant({ rec: summaryContainer, variant })}
    >
      <SummaryItem
        type="staked"
        label={t("dashboard.overview.summary.total_staked")}
        value={allPositionsQuery.data?.allPositionsSum}
        isLoading={allPositionsQuery.isLoading}
      />

      <SummaryItem
        type="rewards"
        label={t("dashboard.overview.summary.total_rewards")}
        value={rewardsPositionsQuery.data?.rewardsPositionsTotalSum}
        isLoading={rewardsPositionsQuery.isLoading}
      />

      <SummaryItem
        type="available"
        label={t("dashboard.overview.summary.available_balance")}
        value={availableBalanceSumQuery.data}
        isLoading={availableBalanceSumQuery.isLoading}
      />
    </Box>
  );
};
