import { DateTime } from "effect";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts";
import type {
  HistoryPeriod,
  HistoryPoint,
} from "../../../../../domain/portfolio/models";
import { useDelayedBusy } from "../../../../../shared/react/use-delayed-busy";
import { vars } from "../../../../../shared/styles/theme/contract.css";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Spinner } from "../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  axisLabel,
  chartContainer,
  chartLoadingOverlay,
  chartSurface,
  chartTooltipContainer,
  chartTooltipDate,
  chartTooltipValue,
  emptyChartContainer,
} from "./styles.css";

type Props = {
  chartId: string;
  data: ReadonlyArray<HistoryPoint>;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshKey: HistoryPeriod;
  tickFormatter: (value: number) => string;
  valueFormatter?: (value: number) => string;
};

const height = 150;

const accentColor = vars.color.primaryButtonBackground;

type EndpointDotProps = {
  cx?: number;
  cy?: number;
  index?: number;
};

export type ChartTooltipProps = {
  active?: boolean;
  chartId?: string;
  formatValue?: (value: number) => string;
  locale?: string;
  payload?: ReadonlyArray<{
    payload?: HistoryPoint;
    value?: number;
  }>;
};

export const ChartTooltip = ({
  active,
  chartId,
  formatValue,
  locale = "en",
  payload,
}: ChartTooltipProps) => {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (
    !point?.timestamp ||
    point.value == null ||
    !Number.isFinite(point.value)
  ) {
    return null;
  }

  const formattedValue = formatValue
    ? formatValue(point.value)
    : `${point.value}`;
  const formattedDate = DateTime.formatUtc(point.timestamp, {
    locale,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Box className={chartTooltipContainer} data-testid={`${chartId}-tooltip`}>
      <Box as="span" className={chartTooltipValue}>
        {formattedValue}
      </Box>
      <Box as="span" className={chartTooltipDate}>
        {formattedDate}
      </Box>
    </Box>
  );
};

export const HistoryChart = ({
  chartId,
  data,
  isLoading,
  isRefreshing,
  refreshKey,
  tickFormatter,
  valueFormatter,
}: Props) => {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const formatValue = valueFormatter ?? tickFormatter;
  const gradientId = `${chartId}-gradient-${useId().replaceAll(":", "")}`;
  const showRefreshChrome = useDelayedBusy(isRefreshing, refreshKey);

  const loadingOverlay = showRefreshChrome ? (
    <Box className={chartLoadingOverlay}>
      <Spinner variant={{ size: "small" }} />
    </Box>
  ) : null;

  if (isLoading && data.length < 2) {
    return <ContentLoaderSquare heightPx={height} />;
  }

  if (data.length < 2) {
    return (
      <Box className={chartContainer}>
        <Box className={emptyChartContainer}>
          <Text variant={{ type: "muted", weight: "normal" }}>
            No chart data
          </Text>
        </Box>

        {loadingOverlay}
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

  const renderActiveDot = ({ cx, cy }: EndpointDotProps) => {
    if (cx == null || cy == null) {
      return <g key={`${chartId}-active-dot`} />;
    }

    return (
      <g key={`${chartId}-active-dot`}>
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
      <Box className={chartSurface({ loading: showRefreshChrome })}>
        <AreaChart
          accessibilityLayer={false}
          data={[...data]}
          margin={{ top: 8, right: 4, bottom: 4, left: 0 }}
          responsive
          style={{ height, width: "100%" }}
          tabIndex={-1}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={accentColor} stopOpacity={0.24} />
              <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey={(point: HistoryPoint) =>
              DateTime.toEpochMillis(point.timestamp)
            }
            hide
          />

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

          <Tooltip
            animationDuration={100}
            content={
              <ChartTooltip
                chartId={chartId}
                formatValue={formatValue}
                locale={locale}
              />
            }
            cursor={{
              stroke: vars.color.tabBorder,
              strokeDasharray: "3 3",
              strokeWidth: 1,
            }}
            isAnimationActive={false}
          />

          <Area
            activeDot={renderActiveDot}
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
      </Box>

      {loadingOverlay}
    </Box>
  );
};
