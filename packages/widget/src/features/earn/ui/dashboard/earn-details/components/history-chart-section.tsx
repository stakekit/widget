import type {
  HistoryPeriod,
  HistoryPoint,
} from "../../../../../../domain/schema/dashboard-models";
import { Box } from "../../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import { HistoryChart } from "../reward-rate-chart";
import * as styles from "../styles.css";

const periods = [
  ["30d", "1M"],
  ["90d", "3M"],
  ["1y", "1Y"],
  ["all", "ALL"],
] as const satisfies ReadonlyArray<readonly [HistoryPeriod, string]>;

export const shouldRenderHistoryChart = (history: {
  data: HistoryPoint[];
  isError: boolean;
  isLoading: boolean;
}) => !history.isError && (history.isLoading || history.data.length >= 2);

export const HistoryChartSection = ({
  chartId,
  history,
  onPeriodChange,
  period,
  tickFormatter,
  title,
  value,
}: {
  chartId: string;
  history: {
    data: HistoryPoint[];
    isFetching: boolean;
    isLoading: boolean;
  };
  onPeriodChange: (period: HistoryPeriod) => void;
  period: HistoryPeriod;
  tickFormatter: (value: number) => string;
  title: string;
  value: string;
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
        {periods.map(([value, label]) => (
          <Box
            as="button"
            className={styles.rangeButton({ active: period === value })}
            key={value}
            onClick={() => onPeriodChange(value)}
            type="button"
          >
            <Text variant={{ type: "muted", weight: "normal" }}>{label}</Text>
          </Box>
        ))}
      </Box>
    </Box>

    <HistoryChart
      chartId={chartId}
      data={history.data}
      isFetching={history.isFetching}
      isLoading={history.isLoading}
      tickFormatter={tickFormatter}
    />
  </Box>
);
