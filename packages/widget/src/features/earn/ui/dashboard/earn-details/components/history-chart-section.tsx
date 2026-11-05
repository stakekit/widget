import { DateTime } from "effect";
import { useTranslation } from "react-i18next";
import type { HistoryPeriod } from "../../../../../../domain/portfolio/models";
import { formatDateTime } from "../../../../../../shared/lib/date";
import { useDelayedBusy } from "../../../../../../shared/react/use-delayed-busy";
import { useWidgetPresentation } from "../../../../../../shared/react/widget-presentation";
import {
  SegmentedControl,
  Stack,
  Text,
  TimeSeriesChart,
  type ToggleOption,
} from "../../../../../../ui/index";
import type { YieldHistoryChartView } from "../../../../state/yield-history-charts";

// History is sampled per day, week, or month at UTC midnight; formatting in
// any other zone would show the neighbouring calendar day.
const historyTimeZone = DateTime.zoneMakeNamedUnsafe("UTC");

const periods = [
  { value: "30d", label: "1M" },
  { value: "90d", label: "3M" },
  { value: "1y", label: "1Y" },
  { value: "all", label: "ALL" },
] as const satisfies ReadonlyArray<ToggleOption<HistoryPeriod>>;

export const HistoryChartSection = ({
  formatValue,
  formatValueAxis,
  onPeriodChange,
  title,
  value,
  view,
}: {
  /** Formats a hovered value. */
  formatValue: (value: number) => string;
  /** Formats the value axis's ticks together, in one precision. */
  formatValueAxis: (ticks: ReadonlyArray<number>) => ReadonlyArray<string>;
  onPeriodChange: (period: HistoryPeriod) => void;
  title: string;
  value: string;
  view: YieldHistoryChartView;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const refreshing = useDelayedBusy(view.isRefreshing, view.period);
  const data = view.points.map((point) => ({
    time: DateTime.toEpochMillis(point.timestamp),
    value: point.value,
  }));

  return (
    <Stack gap={12}>
      <Stack direction="row" align="center" justify="between" gap={8} wrap>
        <Text>
          {title} <Text.Strong>{value}</Text.Strong>
        </Text>

        <SegmentedControl
          label={t("dashboard.earn_details.chart_period", { chart: title })}
          options={periods}
          value={view.period}
          onValueChange={onPeriodChange}
        />
      </Stack>

      <TimeSeriesChart
        label={t("dashboard.earn_details.chart_history", { chart: title })}
        data={data}
        formatValue={formatValue}
        formatValueAxis={formatValueAxis}
        formatTime={(time) =>
          formatDateTime(DateTime.makeUnsafe(time), {
            timeZone: historyTimeZone,
            locale,
            month: "short",
            day: "numeric",
          })
        }
        formatTooltipTime={(time) =>
          formatDateTime(DateTime.makeUnsafe(time), {
            timeZone: historyTimeZone,
            locale,
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        }
        loading={view.isLoading || refreshing}
        emptyLabel={t("dashboard.earn_details.no_chart_data")}
      />
    </Stack>
  );
};
