import { useAtomValue } from "@effect/atom-react";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { SelectedValidators } from "../../../../../domain/earn/reward-rate";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { presentationClockAtom } from "../../../../../shared/effect/presentation-clock";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import { Card, EmptyState, Skeleton, Stack } from "../../../../../ui/index";
import {
  getCampaignMetricCaption,
  getCampaignStatusBadge,
  yieldCampaignAtom,
} from "../../../../campaigns/index";
import { CampaignSection } from "../../../../campaigns/views";
import {
  YieldDetailsHeader,
  YieldFactsSection,
} from "../../../../yield-summary/views";
import { useYieldFlowIntake } from "../../../../yield-transaction-flow/index";
import {
  getRewardRateHistoryChart,
  getTvlHistoryChart,
} from "../../../model/history-chart";
import {
  useEarnDetails,
  useEarnFlowYield,
  useEarnRewardRateHistoryChart,
  useEarnTvlHistoryChart,
  useEarnYieldSelection,
} from "../../use-earn-facades";
import { EarnDetailsMetrics } from "./components/earn-details-metrics";
import { HistoryChartSection } from "./components/history-chart-section";
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
  const { view: entry } = useEarnDetails();
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
  const now = useAtomValue(presentationClockAtom)?.now ?? null;
  const presentsRewardRateHistory = yieldDto
    ? canPresentRewardRateHistory(yieldDto)
    : false;

  const rewardRateChart = useEarnRewardRateHistoryChart(
    presentsRewardRateHistory ? (yieldDto?.id ?? null) : null
  );
  const tvlChart = useEarnTvlHistoryChart(yieldDto?.id ?? null);

  if (isLoading) return <EarnDetailsSkeleton />;

  if (!yieldDto) {
    return <EmptyState title={t("dashboard.earn_details.empty")} />;
  }

  const {
    figures,
    headerBadges,
    isStakeCategory,
    metricCards,
    omittedYieldFacts,
    providerName,
  } = getEarnDetailsModel({
    locale,
    selectedValidators,
    t,
    yieldDto,
  });

  return (
    <Stack gap={16}>
      <EarnDetailsHeader
        headerBadges={headerBadges}
        providerName={providerName}
        yieldDto={yieldDto}
      />

      <EarnDetailsCampaignMetrics cards={metricCards} yieldDto={yieldDto} />

      {providers}

      {presentsRewardRateHistory && rewardRateChart.view.canRender && (
        <HistoryChartSection
          chart={getRewardRateHistoryChart({
            locale,
            now,
            period: rewardRateChart.view.pointsPeriod,
            points: rewardRateChart.view.points,
            rate: figures.rate,
            t,
          })}
          onPeriodChange={rewardRateChart.selectPeriod}
          view={rewardRateChart.view}
        />
      )}

      {!isStakeCategory && tvlChart.view.canRender && (
        <HistoryChartSection
          chart={getTvlHistoryChart({
            locale,
            now,
            period: tvlChart.view.pointsPeriod,
            points: tvlChart.view.points,
            symbol: yieldDto.token.symbol,
            t,
            tvl: figures.tvl,
          })}
          onPeriodChange={tvlChart.selectPeriod}
          view={tvlChart.view}
        />
      )}

      <CampaignSection yieldDto={yieldDto} />

      <YieldFactsSection
        omit={omittedYieldFacts}
        selectedValidators={selectedValidators}
        yieldDto={yieldDto}
      />
    </Stack>
  );
};

const metricPlaceholders = ["first", "second", "third"] as const;

/**
 * The details pane while its yield loads, in the shapes it loads into: the
 * yield's header, the metric card and a history chart, so nothing moves when
 * it arrives.
 */
const EarnDetailsSkeleton = () => (
  <Stack gap={16} aria-busy>
    <Stack direction="row" align="center" gap={12}>
      <Skeleton shape="circle" size="lg" />
      <Stack gap={4} grow>
        <Skeleton shape="line" variant="heading" width="threeQuarters" />
        <Skeleton shape="line" variant="caption" width="half" />
      </Stack>
    </Stack>

    <Card padding={16}>
      <Stack direction="row" gap={16}>
        {metricPlaceholders.map((key) => (
          <Stack key={key} gap={4} grow>
            <Skeleton shape="line" variant="caption" width="half" />
            <Skeleton shape="line" variant="heading" width="threeQuarters" />
          </Stack>
        ))}
      </Stack>
    </Card>

    <Stack gap={12}>
      <Stack direction="row" align="center" justify="between" gap={8}>
        <Skeleton shape="line" width="quarter" />
        <Skeleton shape="rect" height="sm" width="quarter" />
      </Stack>
      <Skeleton shape="rect" height="section" />
    </Stack>

    <Stack gap={8}>
      <Skeleton shape="line" width="quarter" />
      <Skeleton shape="line" width="threeQuarters" />
      <Skeleton shape="line" width="half" />
    </Stack>
  </Stack>
);

/** The yield header, led by its campaign's state when it runs one. */
const EarnDetailsHeader = (
  props: Omit<ComponentProps<typeof YieldDetailsHeader>, "status">
) => {
  const { t } = useTranslation();
  const campaign = useAtomValue(yieldCampaignAtom(props.yieldDto.id));

  return (
    <YieldDetailsHeader
      {...props}
      status={campaign ? getCampaignStatusBadge(campaign, t) : null}
    />
  );
};

/** The metric cards, the reward rate's saying what its campaign adds. */
const EarnDetailsCampaignMetrics = ({
  cards,
  yieldDto,
}: {
  readonly cards: ComponentProps<typeof EarnDetailsMetrics>["cards"];
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const campaign = useAtomValue(yieldCampaignAtom(yieldDto.id));
  const caption = campaign
    ? getCampaignMetricCaption(campaign, yieldDto, t, locale)
    : null;

  return (
    <EarnDetailsMetrics
      cards={cards.map((card) =>
        card.id === "reward-rate" && caption
          ? { ...card, subValue: caption }
          : card
      )}
    />
  );
};
