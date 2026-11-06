import { useTranslation } from "react-i18next";
import { Box, Card, MetricGroup, Stack, Text } from "../../../../ui/index";
import { useSummary } from "../../react/use-summary";
import { SummaryMetric } from "./summary-metric";

/**
 * Manage's summary over its positions, the same figures in every Layout and
 * state: total value, average APY and claimable rewards, and with borrow
 * positions their debt and the net worth left.
 */
export const ManageSummary = () => {
  const { t } = useTranslation();
  const summary = useSummary();

  return (
    <Stack gap={8}>
      {/* A short band of figures: less padding above and below than beside. */}
      <Card padding={0} testId="positions__summary">
        <Box paddingBlock={12} paddingInline={16}>
          <MetricGroup>
            <SummaryMetric
              kind="usd"
              label={t("dashboard.overview.summary.total_value")}
              figure={summary.totalValue}
              isPartial={summary.isPartial}
            />
            <SummaryMetric
              kind="percent"
              label={t("dashboard.overview.summary.average_apy")}
              figure={summary.averageApy}
              isPartial={summary.isPartial}
            />
            <SummaryMetric
              kind="usd"
              label={t("dashboard.overview.summary.claimable_rewards")}
              figure={summary.claimableRewards}
              isPartial={summary.isPartial}
            />
            {summary.borrow ? (
              <>
                <SummaryMetric
                  kind="usd"
                  label={t("dashboard.overview.summary.debt")}
                  figure={summary.borrow.debt}
                  isPartial={summary.isPartial}
                />
                <SummaryMetric
                  kind="usd"
                  label={t("dashboard.overview.summary.net_worth")}
                  figure={summary.borrow.netWorth}
                  isPartial={summary.isPartial}
                />
              </>
            ) : null}
          </MetricGroup>
        </Box>
      </Card>
      {summary.excludesHidden ? (
        <Text variant="caption" tone="muted">
          {t("dashboard.overview.summary.excludes_confidential")}
        </Text>
      ) : null}
    </Stack>
  );
};
