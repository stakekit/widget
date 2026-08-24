import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import type { SelectedValidators } from "../../../../../domain/earn/reward-rate";
import { formatUsd } from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "../../../../../shared/ui/components/details-section";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { YieldDetailsHeader } from "../../../../yield-summary/views";
import {
  useEarnEntry,
  useEarnRewardRateHistoryChart,
  useEarnTvlHistoryChart,
  useEarnYieldSelection,
} from "../../../react/use-earn-facades";
import { EarnDetailsMetrics } from "./components/earn-details-metrics";
import { HistoryChartSection } from "./components/history-chart-section";
import { IntegrationDocsLink } from "./components/integration-docs-link";
import { ProviderSelectionCard } from "./components/provider-selection-card";
import {
  canPresentRewardRateHistory,
  getEarnDetailsModel,
} from "./earn-details-model";
import * as styles from "./styles.css";

export const EarnDetails = () => {
  const { view: entry } = useEarnEntry();
  const { view: yieldSelection } = useEarnYieldSelection();

  return (
    <EarnDetailsView
      isLoading={entry.appLoading || yieldSelection.isLoading}
      selectedValidators={entry.selectedValidators}
      yieldDto={entry.selectedStake}
    />
  );
};

const EarnDetailsView = ({
  isLoading,
  selectedValidators,
  yieldDto,
}: {
  isLoading: boolean;
  selectedValidators?: SelectedValidators | null;
  yieldDto: EarnYieldWithProvider | null;
}) => {
  const { t } = useTranslation();
  const presentsRewardRateHistory = yieldDto
    ? canPresentRewardRateHistory(yieldDto)
    : false;

  const rewardRateChart = useEarnRewardRateHistoryChart(
    presentsRewardRateHistory ? (yieldDto?.id ?? null) : null
  );
  const tvlChart = useEarnTvlHistoryChart(yieldDto?.id ?? null);

  if (isLoading) {
    return <ContentLoaderSquare heightPx={430} />;
  }

  if (!yieldDto) {
    return (
      <Box
        alignItems="center"
        className={styles.container}
        display="flex"
        justifyContent="center"
      >
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("dashboard.earn_details.empty")}
        </Text>
      </Box>
    );
  }

  const {
    addressRows,
    detailRows,
    headerBadges,
    isStakeCategory,
    metricCards,
    providerName,
    rewardRateFormatted,
    tvlChartValue,
  } = getEarnDetailsModel({
    selectedValidators,
    t,
    yieldDto,
  });

  return (
    <Box
      className={styles.container}
      display="flex"
      flexDirection="column"
      gap="4"
    >
      <YieldDetailsHeader
        headerBadges={headerBadges}
        providerName={providerName}
        yieldDto={yieldDto}
      />

      <EarnDetailsMetrics cards={metricCards} />

      <ProviderSelectionCard />

      {presentsRewardRateHistory && rewardRateChart.view.canRender && (
        <HistoryChartSection
          chartId="reward-rate"
          onPeriodChange={rewardRateChart.selectPeriod}
          tickFormatter={(value) => `${formatNumber(value, 2)}%`}
          title={t("dashboard.earn_details.reward_rate")}
          value={rewardRateFormatted}
          view={rewardRateChart.view}
        />
      )}

      {!isStakeCategory && tvlChart.view.canRender && (
        <HistoryChartSection
          chartId="tvl"
          onPeriodChange={tvlChart.selectPeriod}
          tickFormatter={formatUsd}
          title={t("dashboard.earn_details.tvl")}
          value={tvlChartValue}
          view={tvlChart.view}
        />
      )}

      <DetailsSection title={t("dashboard.earn_details.about")}>
        <Box display="flex" flexDirection="column" gap="1">
          <Text variant={{ type: "muted", weight: "normal" }}>
            {yieldDto.metadata.description}
          </Text>

          {yieldDto.metadata.documentation ? (
            <IntegrationDocsLink
              documentation={yieldDto.metadata.documentation}
            />
          ) : null}
        </Box>
      </DetailsSection>

      <DetailsSection title={t("dashboard.earn_details.details")}>
        {detailRows.map((row) => (
          <DetailRow key={row.id} {...row} />
        ))}

        {addressRows.length > 0 && (
          <Box display="flex" flexDirection="column" gap="2" marginTop="2">
            {addressRows.map((row) => (
              <AddressRow key={`${row.label}-${row.address}`} {...row} />
            ))}
          </Box>
        )}
      </DetailsSection>
    </Box>
  );
};
