import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { Text } from "../../../components/atoms/typography/text";
import type { SelectedValidators } from "../../../domain/types/reward-rate";
import type { Yield } from "../../../domain/types/yields";
import { useEarnPageContext } from "../../../pages/details/earn-page/state/earn-page-context";
import { formatNumber } from "../../../utils";
import { formatCompactUsd } from "../../../utils/formatters";
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
import {
  type RewardRateHistoryPeriod,
  useYieldRewardRateHistory,
} from "./use-yield-reward-rate-history";
import { useYieldTvlHistory } from "./use-yield-tvl-history";

export const EarnDetails = () => {
  const {
    appLoading,
    selectedStake,
    selectedValidators,
    selectYieldIsLoading,
  } = useEarnPageContext();

  return (
    <EarnDetailsView
      isLoading={appLoading || selectYieldIsLoading}
      selectedValidators={selectedValidators}
      yieldDto={selectedStake.extractNullable()}
    />
  );
};

export const EarnDetailsView = ({
  isLoading,
  selectedValidators,
  yieldDto,
}: {
  isLoading: boolean;
  selectedValidators?: SelectedValidators | null;
  yieldDto: Yield | null;
}) => {
  const [rewardRatePeriod, setRewardRatePeriod] =
    useState<RewardRateHistoryPeriod>("90d");
  const [tvlPeriod, setTvlPeriod] = useState<RewardRateHistoryPeriod>("90d");
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
