import type BigNumber from "bignumber.js";
import { useTranslation } from "react-i18next";
import { emptyBorrowPositions } from "../../../../../domain/borrow/positions/borrow-positions";
import { exactZero } from "../../../../../domain/finance/exact";
import {
  formatPercent,
  formatUsd,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  Box,
  Card,
  Metric,
  MetricGroup,
  Skeleton,
  Stack,
  Text,
} from "../../../../../ui/index";
import { usePortfolioBorrowPositions } from "../../../react/use-borrow-positions";
import { useSummary } from "../../../react/use-summary";

/** A summary figure: the label above its neutral value, or a loader. */
const SummaryMetric = ({
  label,
  value,
  isLoading,
  kind,
}: {
  readonly label: string;
  readonly value: BigNumber | undefined;
  readonly isLoading: boolean;
  readonly kind: "usd" | "percent";
}) => {
  const { locale } = useWidgetPresentation();
  const formatted = (() => {
    if (!value) return "-";
    if (kind === "percent") {
      return value.gt(0) ? formatPercent(value.dividedBy(100), locale) : "-";
    }
    return formatUsd(value, locale);
  })();

  return (
    <Metric
      label={label}
      value={
        isLoading ? (
          <Skeleton shape="rect" height="sm" width="half" />
        ) : (
          formatted
        )
      }
    />
  );
};

export const Summary = () => {
  const summary = useSummary();
  const allPositions =
    summary.allPositions._tag === "Ready"
      ? summary.allPositions.value
      : undefined;
  const averageApy =
    summary.averageApy._tag === "Ready" ? summary.averageApy.value : undefined;
  const availableBalance =
    summary.availableBalance._tag === "Ready"
      ? summary.availableBalance.value
      : undefined;
  const borrowPositions = usePortfolioBorrowPositions();
  const borrowPositionsAreLoading =
    borrowPositions.enabled &&
    borrowPositions.connectionStatus === "connected" &&
    borrowPositions.positions._tag === "Loading";
  const hasBorrowPositions =
    borrowPositions.enabled &&
    borrowPositions.positions._tag === "Ready" &&
    borrowPositions.positions.value.length > 0;
  const borrowTotals =
    borrowPositions.totals._tag === "Ready"
      ? borrowPositions.totals.value
      : emptyBorrowPositions.totals;
  const borrowApySummary = {
    totalValue: borrowTotals.netApyWeightUsd,
    weightedApy: borrowTotals.netApy
      .multipliedBy(100)
      .multipliedBy(borrowTotals.netApyWeightUsd),
  };
  const totalPositionsValue = hasBorrowPositions
    ? (allPositions?.allPositionsSum ?? exactZero()).plus(
        borrowTotals.totalSuppliedUsd
      )
    : allPositions?.allPositionsSum;
  const averageApyValue = (() => {
    if (!hasBorrowPositions) {
      return averageApy;
    }

    const earnPositionsValue = allPositions?.allPositionsSum ?? exactZero();
    const totalValue = earnPositionsValue.plus(borrowApySummary.totalValue);

    if (!totalValue.gt(0)) {
      return exactZero();
    }

    const earnWeightedApy =
      averageApy?.times(earnPositionsValue) ?? exactZero();

    return earnWeightedApy.plus(borrowApySummary.weightedApy).div(totalValue);
  })();
  const availableOrNetWorthValue = hasBorrowPositions
    ? (allPositions?.allPositionsSum ?? exactZero()).plus(
        borrowTotals.netWorthUsd
      )
    : availableBalance;

  const { t } = useTranslation();

  return (
    <Stack gap={8}>
      {/* A short band of figures: less padding above and below than beside. */}
      <Card padding={0}>
        <Box paddingBlock={12} paddingInline={16}>
          <MetricGroup columns={{ base: 1, sm: 3 }}>
            <SummaryMetric
              kind="usd"
              label={t(
                hasBorrowPositions
                  ? "dashboard.overview.summary.total_supplied"
                  : "dashboard.overview.summary.total_staked"
              )}
              value={totalPositionsValue}
              isLoading={
                summary.allPositions._tag === "Loading" ||
                borrowPositionsAreLoading
              }
            />

            <SummaryMetric
              kind="percent"
              label={t("dashboard.overview.summary.average_apy")}
              value={averageApyValue}
              isLoading={
                summary.averageApy._tag === "Loading" ||
                borrowPositionsAreLoading
              }
            />

            <SummaryMetric
              kind="usd"
              label={t(
                hasBorrowPositions
                  ? "dashboard.overview.summary.net_worth"
                  : "dashboard.overview.summary.available_balance"
              )}
              value={availableOrNetWorthValue}
              isLoading={
                hasBorrowPositions
                  ? summary.allPositions._tag === "Loading" ||
                    borrowPositionsAreLoading
                  : summary.availableBalance._tag === "Loading"
              }
            />
          </MetricGroup>
        </Box>
      </Card>
      {allPositions?.excludesHidden ? (
        <Text variant="caption" tone="muted">
          {t("dashboard.overview.summary.excludes_confidential")}
        </Text>
      ) : null}
    </Stack>
  );
};
