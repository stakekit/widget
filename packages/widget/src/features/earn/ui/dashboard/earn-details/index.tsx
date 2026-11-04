import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import type { SelectedValidators } from "../../../../../domain/earn/reward-rate";
import { exactDecimal } from "../../../../../domain/finance/exact";
import { formatAddress } from "../../../../../shared/lib/general";
import {
  formatPercent,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  DetailList,
  DetailRow,
  Disclosure,
  EmptyState,
  Skeleton,
  Stack,
  Text,
} from "../../../../../ui/index";
import { YieldDetailsHeader } from "../../../../yield-summary/views";
import { useYieldFlowIntake } from "../../../../yield-transaction-flow/index";
import {
  useEarnEntry,
  useEarnFlowYield,
  useEarnRewardRateHistoryChart,
  useEarnTvlHistoryChart,
  useEarnYieldSelection,
} from "../../../react/use-earn-facades";
import { EarnDetailsMetrics } from "./components/earn-details-metrics";
import { HistoryChartSection } from "./components/history-chart-section";
import { IntegrationDocsLink } from "./components/integration-docs-link";
import {
  ProviderSelectionCard,
  ProviderSummary,
} from "./components/provider-selection-card";
import {
  canPresentRewardRateHistory,
  getEarnDetailsModel,
} from "./earn-details-model";

/** Details of the Earn form's live selection; its selection controls edit it. */
export const EarnDetails = () => {
  const { view: entry } = useEarnEntry();
  const { view: yieldSelection } = useEarnYieldSelection();

  return (
    <EarnDetailsPanel
      isLoading={entry.appLoading || yieldSelection.isLoading}
      providers={<ProviderSelectionCard />}
      selectedValidators={entry.selectedValidators}
      yieldDto={entry.selectedStake}
    />
  );
};

/**
 * Details of the target a started Enter flow executes against, captured in its
 * Session intake. It never follows the Earn form's live selection.
 */
export const EarnFlowDetails = () => {
  const intake = useYieldFlowIntake("Enter");
  const yieldDto = useEarnFlowYield(intake.selectedStake);
  const selectedValidators = [...intake.selectedValidators.values()];

  return (
    <EarnDetailsPanel
      isLoading={false}
      providers={
        <ProviderSummary
          providerOption={intake.selectedProviderOption}
          selectedValidators={selectedValidators}
          yieldDto={yieldDto}
        />
      }
      selectedValidators={selectedValidators}
      yieldDto={yieldDto}
    />
  );
};

const EarnDetailsPanel = ({
  isLoading,
  providers,
  selectedValidators,
  yieldDto,
}: {
  readonly isLoading: boolean;
  /** The provider and validator section for `yieldDto`. */
  readonly providers: ReactNode;
  readonly selectedValidators: SelectedValidators | null;
  readonly yieldDto: EarnYieldWithProvider | null;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const presentsRewardRateHistory = yieldDto
    ? canPresentRewardRateHistory(yieldDto)
    : false;

  const rewardRateChart = useEarnRewardRateHistoryChart(
    presentsRewardRateHistory ? (yieldDto?.id ?? null) : null
  );
  const tvlChart = useEarnTvlHistoryChart(yieldDto?.id ?? null);

  if (isLoading) {
    return (
      <Stack gap={16} aria-busy>
        <Skeleton shape="rect" height="lg" />
        <Skeleton shape="rect" height="lg" />
        <Skeleton shape="rect" height="lg" />
        <Skeleton shape="line" width="threeQuarters" />
        <Skeleton shape="line" width="half" />
      </Stack>
    );
  }

  if (!yieldDto) {
    return <EmptyState title={t("dashboard.earn_details.empty")} />;
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
    locale,
    selectedValidators,
    t,
    yieldDto,
  });

  return (
    <Stack gap={16}>
      <YieldDetailsHeader
        headerBadges={headerBadges}
        providerName={providerName}
        yieldDto={yieldDto}
      />

      <EarnDetailsMetrics cards={metricCards} />

      {providers}

      {presentsRewardRateHistory && rewardRateChart.view.canRender && (
        <HistoryChartSection
          onPeriodChange={rewardRateChart.selectPeriod}
          tickFormatter={(value) =>
            formatPercent(exactDecimal(value).div(100), locale)
          }
          title={t("dashboard.earn_details.reward_rate")}
          value={rewardRateFormatted}
          view={rewardRateChart.view}
        />
      )}

      {!isStakeCategory && tvlChart.view.canRender && (
        <HistoryChartSection
          onPeriodChange={tvlChart.selectPeriod}
          tickFormatter={(value) => formatUsd(value, locale)}
          title={t("dashboard.earn_details.tvl")}
          value={tvlChartValue}
          view={tvlChart.view}
        />
      )}

      <Disclosure title={t("dashboard.earn_details.about")} defaultOpen>
        <Stack gap={4}>
          <Text tone="muted">{yieldDto.metadata.description}</Text>

          {yieldDto.metadata.documentation ? (
            <IntegrationDocsLink
              documentation={yieldDto.metadata.documentation}
            />
          ) : null}
        </Stack>
      </Disclosure>

      <Disclosure title={t("dashboard.earn_details.details")} defaultOpen>
        <DetailList>
          {detailRows.map((row) => (
            <DetailRow key={row.id} label={row.label} value={row.value} />
          ))}

          {addressRows.map((row) => (
            <DetailRow
              key={`${row.label}-${row.address}`}
              label={row.label}
              value={formatAddress(row.address)}
              copyable={{
                value: row.address,
                label: t("wallet_modal.copy_address"),
                copiedLabel: t("wallet_modal.copied"),
              }}
            />
          ))}
        </DetailList>
      </Disclosure>
    </Stack>
  );
};
