import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Box } from "../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../components/atoms/content-loader";
import { Spinner } from "../../../components/atoms/spinner";
import { Text } from "../../../components/atoms/typography/text";
import { vars } from "../../../styles/theme/contract.css";
import {
  axisLabel,
  chartContainer,
  chartLoadingOverlay,
  emptyChartContainer,
} from "./styles.css";
import type { RewardRateHistoryPoint } from "./use-yield-reward-rate-history";

type Props = {
  chartId: string;
  data: RewardRateHistoryPoint[];
  isFetching: boolean;
  isLoading: boolean;
  tickFormatter: (value: number) => string;
};

const height = 150;

const accentColor = vars.color.primaryButtonBackground;

type EndpointDotProps = {
  cx?: number;
  cy?: number;
  index?: number;
};

export const HistoryChart = ({
  chartId,
  data,
  isFetching,
  isLoading,
  tickFormatter,
}: Props) => {
  const gradientId = `${chartId}-gradient-${useId().replaceAll(":", "")}`;

  if (isLoading && data.length < 2) {
    return <ContentLoaderSquare heightPx={height} />;
  }

  if (data.length < 2) {
    return (
      <Box className={emptyChartContainer}>
        <Text variant={{ type: "muted", weight: "normal" }}>No chart data</Text>
      </Box>
    );
  }

  const values = data.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.2, 0.05);
  const domainMin = Math.max(0, min - padding);
  const domainMax = domainMin === max + padding ? domainMin + 1 : max + padding;
  const ticks = [domainMin, (domainMin + domainMax) / 2, domainMax];

  const lastIndex = data.length - 1;

  const renderEndpointDot = ({ cx, cy, index }: EndpointDotProps) => {
    if (index !== lastIndex || cx == null || cy == null) {
      return <g key={`${chartId}-dot-${index}`} />;
    }

    return (
      <g key={`${chartId}-endpoint`}>
        <circle cx={cx} cy={cy} fill={accentColor} fillOpacity={0.25} r={6} />
        <circle
          cx={cx}
          cy={cy}
          fill={accentColor}
          r={3.5}
          stroke={vars.color.background}
          strokeWidth={1.5}
        />
      </g>
    );
  };

  return (
    <Box className={chartContainer}>
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart
          accessibilityLayer={false}
          data={data}
          margin={{ top: 8, right: 4, bottom: 4, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.24} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis dataKey="timestamp" hide />

          <YAxis
            axisLine={false}
            domain={[domainMin, domainMax]}
            orientation="right"
            tick={{ className: axisLabel }}
            tickFormatter={tickFormatter}
            tickLine={false}
            ticks={ticks}
            width={46}
          />

          <Area
            activeDot={false}
            dataKey="value"
            dot={renderEndpointDot}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            stroke={accentColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            type="monotone"
          />
        </AreaChart>
      </ResponsiveContainer>

      {isFetching && (
        <Box className={chartLoadingOverlay}>
          <Spinner />
        </Box>
      )}
    </Box>
  );
};
