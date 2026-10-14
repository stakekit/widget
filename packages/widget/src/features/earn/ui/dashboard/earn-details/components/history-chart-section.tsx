import type { HistoryPeriod } from "../../../../../../domain/portfolio/models";
import { lazyComponent } from "../../../../../../shared/ui/components/lazy-component";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { YieldHistoryChartView } from "../../../../state/yield-history-charts";
import * as styles from "../styles.css";

// The chart carries recharts, so both load when a chart first renders. The
// fallback matches the chart's own loading skeleton.
const HistoryChart = lazyComponent(
  () => import("../reward-rate-chart"),
  "HistoryChart",
  <ContentLoaderSquare heightPx={150} />
);

const periods = [
  ["30d", "1M"],
  ["90d", "3M"],
  ["1y", "1Y"],
  ["all", "ALL"],
] as const satisfies ReadonlyArray<readonly [HistoryPeriod, string]>;

export const HistoryChartSection = ({
  chartId,
  onPeriodChange,
  tickFormatter,
  title,
  value,
  valueFormatter,
  view,
}: {
  chartId: string;
  onPeriodChange: (period: HistoryPeriod) => void;
  tickFormatter: (value: number) => string;
  title: string;
  value: string;
  valueFormatter?: (value: number) => string;
  view: YieldHistoryChartView;
}) => (
  <Box>
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Text variant={{ weight: "normal" }}>
        {title}{" "}
        <Box as="span" fontWeight="bold">
          {value}
        </Box>
      </Text>

      <Box display="flex" gap="1">
        {periods.map(([periodValue, label]) => (
          <Box
            as="button"
            className={styles.rangeButton({
              active: view.period === periodValue,
            })}
            key={periodValue}
            onClick={() => onPeriodChange(periodValue)}
            type="button"
          >
            <Text variant={{ type: "muted", weight: "normal" }}>{label}</Text>
          </Box>
        ))}
      </Box>
    </Box>

    <HistoryChart
      chartId={chartId}
      data={view.points}
      isLoading={view.isLoading}
      isRefreshing={view.isRefreshing}
      refreshKey={view.period}
      tickFormatter={tickFormatter}
      valueFormatter={valueFormatter}
    />
  </Box>
);
