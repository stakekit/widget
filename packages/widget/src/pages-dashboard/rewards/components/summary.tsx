import { Box } from "@sk-widget/components/atoms/box";
import { SummaryItem } from "@sk-widget/components/molecules/summary-item";
import { summaryContainer } from "@sk-widget/components/molecules/summary-item/index.css";
import { useSummary } from "@sk-widget/hooks/use-summary";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import { useTranslation } from "react-i18next";

export const Summary = () => {
  const { rewardsPositionsQuery } = useSummary();

  const { t } = useTranslation();

  const { variant } = useSettings();

  return (
    <Box
      className={combineRecipeWithVariant({
        rec: summaryContainer,
        variant,
      })}
    >
      <SummaryItem
        type="rewards"
        label={t("dashboard.rewards.summary.all_time")}
        value={rewardsPositionsQuery.data?.rewardsPositionsTotalSum}
        isLoading={
          rewardsPositionsQuery.isLoading || rewardsPositionsQuery.isPending
        }
      />

      <SummaryItem
        type="rewards"
        label={t("dashboard.rewards.summary.one_month")}
        value={rewardsPositionsQuery.data?.rewardsPositionsLastMonthSum}
        isLoading={
          rewardsPositionsQuery.isLoading || rewardsPositionsQuery.isPending
        }
      />

      <SummaryItem
        type="rewards"
        label={t("dashboard.rewards.summary.one_week")}
        value={rewardsPositionsQuery.data?.rewardsPositionsLastWeekSum}
        isLoading={
          rewardsPositionsQuery.isLoading || rewardsPositionsQuery.isPending
        }
      />
    </Box>
  );
};
