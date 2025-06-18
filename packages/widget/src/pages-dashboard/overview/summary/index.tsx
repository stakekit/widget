import { Box } from "@sk-widget/components/atoms/box";
import { SummaryItem } from "@sk-widget/components/molecules/summary-item";
import { summaryContainer } from "@sk-widget/components/molecules/summary-item/index.css";
import { useSummary } from "@sk-widget/hooks/use-summary";
import { useSettings } from "@sk-widget/providers/settings";
import { combineRecipeWithVariant } from "@sk-widget/utils/styles";
import { useTranslation } from "react-i18next";

export const Summary = () => {
  const {
    allPositionsQuery,
    // rewardsPositionsQuery,
    availableBalanceSumQuery,
  } = useSummary();

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
        type="staked"
        label={t("dashboard.overview.summary.total_staked")}
        value={allPositionsQuery.data?.allPositionsSum}
        isLoading={allPositionsQuery.isLoading || allPositionsQuery.isPending}
      />

      {/* <SummaryItem
        type="rewards"
        label={t("dashboard.overview.summary.total_rewards")}
        value={rewardsPositionsQuery.data?.rewardsPositionsTotalSum}
        isLoading={
          rewardsPositionsQuery.isLoading || rewardsPositionsQuery.isPending
        }
      /> */}

      <SummaryItem
        type="available"
        label={t("dashboard.overview.summary.available_balance")}
        value={availableBalanceSumQuery.data}
        isLoading={
          availableBalanceSumQuery.isLoading ||
          availableBalanceSumQuery.isPending
        }
      />
    </Box>
  );
};
