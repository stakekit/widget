import { useTranslation } from "react-i18next";

import type { HistoryPeriod } from "../../../../../../domain/portfolio/models";
import { useDelayedBusy } from "../../../../../../shared/react/use-delayed-busy";
import {
  SegmentedControl,
  Stack,
  Text,
  TimeSeriesChart,
  type ToggleOption,
} from "../../../../../../ui/index";
import type { HistoryChart } from "../../../../model/history-chart";
import type { YieldHistoryChartView } from "../../../../state/yield-history-charts";

/**
 * A yield's history chart under its title and headline figure, and the
 * period control.
 */
export const HistoryChartSection = ({
  chart,
  onPeriodChange,
  view,
}: {
  readonly chart: HistoryChart;
  readonly onPeriodChange: (period: HistoryPeriod) => void;
  readonly view: YieldHistoryChartView;
}) => {
  const { t } = useTranslation();
  const refreshing = useDelayedBusy(view.isRefreshing, view.period);
  const periods = [
    { value: "30d", label: t("dashboard.earn_details.period_1m") },
    { value: "90d", label: t("dashboard.earn_details.period_3m") },
    { value: "1y", label: t("dashboard.earn_details.period_1y") },
    { value: "all", label: t("dashboard.earn_details.period_all") },
  ] as const satisfies ReadonlyArray<ToggleOption<HistoryPeriod>>;

  return (
    <Stack gap={12}>
      <Stack direction="row" align="center" justify="between" gap={8} wrap>
        <Stack gap={2}>
          <Text>
            {chart.title}
            {chart.figure !== null && (
              <>
                {" "}
                <Text.Strong>{chart.figure}</Text.Strong>
              </>
            )}
          </Text>
          {chart.secondary !== null && (
            <Text variant="caption" tone="muted" numeric>
              {chart.secondary}
            </Text>
          )}
        </Stack>

        <SegmentedControl
          label={t("dashboard.earn_details.chart_period", {
            chart: chart.title,
          })}
          options={periods}
          value={view.period}
          onValueChange={onPeriodChange}
        />
      </Stack>

      <TimeSeriesChart
        label={t("dashboard.earn_details.chart_history", {
          chart: chart.title,
        })}
        data={chart.data}
        valueAxis={chart.valueAxis}
        timeAxis={chart.timeAxis}
        formatTooltipValue={chart.formatValue}
        formatTooltipTime={chart.formatTime}
        {...(chart.latestLabel === null
          ? {}
          : { latestLabel: chart.latestLabel })}
        {...(chart.caption === null ? {} : { caption: chart.caption })}
        loading={view.isLoading || refreshing}
        emptyLabel={t("dashboard.earn_details.no_chart_data")}
      />
    </Stack>
  );
};
