import type { HistoryPeriod } from "../../../../../../domain/portfolio/models";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import type { YieldHistoryChartView } from "../../../../state/yield-history-charts";
import { HistoryChart } from "../reward-rate-chart";
import * as styles from "../styles.css";

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
  view,
}: {
  chartId: string;
  onPeriodChange: (period: HistoryPeriod) => void;
  tickFormatter: (value: number) => string;
  title: string;
  value: string;
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
    />
  </Box>
);
