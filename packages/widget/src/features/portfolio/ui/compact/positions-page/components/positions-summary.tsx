import { useTranslation } from "react-i18next";
import {
  Box,
  Card,
  MetricGroup,
  Stack,
  Text,
} from "../../../../../../ui/index";
import { useSummary } from "../../../../react/use-summary";
import { SummaryMetric } from "../../../components/summary-metric";

/**
 * Compact Manage's summary strip over its positions: their total USD value,
 * their value-weighted average APY and, when any, their claimable rewards.
 */
export const PositionsSummary = () => {
  const { t } = useTranslation();
  const summary = useSummary();
  const allPositions =
    summary.allPositions._tag === "Ready"
      ? summary.allPositions.value
      : undefined;
  const claimableRewards =
    summary.claimableRewards._tag === "Ready" &&
    summary.claimableRewards.value.isGreaterThan(0)
      ? summary.claimableRewards.value
      : null;

  return (
    <Stack gap={8}>
      {/* A short band of figures: less padding above and below than beside. */}
      <Card padding={0} testId="positions__summary">
        <Box paddingBlock={12} paddingInline={16}>
          <MetricGroup columns={claimableRewards ? 3 : 2}>
            <SummaryMetric
              kind="usd"
              label={t("dashboard.overview.summary.total_value")}
              value={allPositions?.allPositionsSum}
              isLoading={summary.allPositions._tag === "Loading"}
            />
            <SummaryMetric
              kind="percent"
              label={t("dashboard.overview.summary.average_apy")}
              value={
                summary.averageApy._tag === "Ready"
                  ? summary.averageApy.value
                  : undefined
              }
              isLoading={summary.averageApy._tag === "Loading"}
            />
            {claimableRewards ? (
              <SummaryMetric
                kind="usd"
                label={t("dashboard.overview.summary.claimable_rewards")}
                value={claimableRewards}
                isLoading={false}
              />
            ) : null}
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
