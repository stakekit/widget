import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { HistoryPeriod } from "../../../../../domain/schema/dashboard-models";
import type { EarnYieldWithProvider } from "../../../../../domain/schema/earn-models";
import type { SelectedValidators } from "../../../../../domain/types/reward-rate";
import { formatCompactUsd } from "../../../../../shared/lib/formatters";
import { formatNumber } from "../../../../../shared/lib/number-format";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useEarnPageModel } from "../../classic/earn-page/state/earn-page-model";
import {
  AddressRow,
  DetailRow,
  DetailsSection,
} from "./components/details-section";
import { EarnDetailsHeader } from "./components/earn-details-header";
import { EarnDetailsMetrics } from "./components/earn-details-metrics";
import {
  HistoryChartSection,
  shouldRenderHistoryChart,
} from "./components/history-chart-section";
import { IntegrationDocsLink } from "./components/integration-docs-link";
import { ProviderSelectionCard } from "./components/provider-selection-card";
import { getEarnDetailsModel } from "./earn-details-model";
import * as styles from "./styles.css";
import { useYieldRewardRateHistory } from "./use-yield-reward-rate-history";
import { useYieldTvlHistory } from "./use-yield-tvl-history";

export const EarnDetails = () => {
  const {
    appLoading,
    selectedStake,
    selectedValidators,
    selectYieldIsLoading,
  } = useEarnPageModel();

  return (
    <EarnDetailsView
      isLoading={appLoading || selectYieldIsLoading}
      selectedValidators={selectedValidators}
      yieldDto={selectedStake}
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
  const [rewardRatePeriod, setRewardRatePeriod] =
    useState<HistoryPeriod>("90d");
  const [tvlPeriod, setTvlPeriod] = useState<HistoryPeriod>("90d");
  const { t } = useTranslation();

  const rewardRateHistory = useYieldRewardRateHistory({
    period: rewardRatePeriod,
    yieldId: yieldDto?.id,
  });
  const tvlHistory = useYieldTvlHistory({
    period: tvlPeriod,
    yieldId: yieldDto?.id,
  });

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
      <EarnDetailsHeader
        headerBadges={headerBadges}
        providerName={providerName}
        yieldDto={yieldDto}
      />

      <EarnDetailsMetrics cards={metricCards} />

      <ProviderSelectionCard />

      {shouldRenderHistoryChart(rewardRateHistory) && (
        <HistoryChartSection
          chartId="reward-rate"
          history={rewardRateHistory}
          onPeriodChange={setRewardRatePeriod}
          period={rewardRatePeriod}
          tickFormatter={(value) => `${formatNumber(value, 2)}%`}
          title={t("dashboard.earn_details.reward_rate")}
          value={rewardRateFormatted}
        />
      )}

      {!isStakeCategory && shouldRenderHistoryChart(tvlHistory) && (
        <HistoryChartSection
          chartId="tvl"
          history={tvlHistory}
          onPeriodChange={setTvlPeriod}
          period={tvlPeriod}
          tickFormatter={formatCompactUsd}
          title={t("dashboard.earn_details.tvl")}
          value={tvlChartValue}
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
