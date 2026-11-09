import { useTranslation } from "react-i18next";
import { Card, Stack, Text } from "../../../../ui/index";
import { useSummary } from "../../react/use-summary";
import { SummaryMetric } from "./summary-metric";

/**
 * Manage's summary over its positions, the same figures in every Layout and
 * state, in one compact row: the total value leads, then average APY and
 * claimable rewards, and with borrow positions their debt and the net worth
 * left.
 */
export const ManageSummary = () => {
  const { t } = useTranslation();
  const summary = useSummary();

  return (
    <Stack gap={8}>
      <Card padding={12} testId="positions__summary">
        {/* One row: the total leads, its smaller metrics beside it, each as
            wide as its label; a row too narrow for both wraps the metrics
            under the total. */}
        <Stack direction="row" wrap align="center" justify="between" gap={16}>
          <SummaryMetric
            kind="usd"
            size="lead"
            label={t("dashboard.overview.summary.total_value")}
            figure={summary.totalValue}
            isPartial={summary.isPartial}
          />
          <Stack direction="row" wrap gap={24}>
            <SummaryMetric
              kind="percent"
              label={t("dashboard.overview.summary.average_apy")}
              figure={summary.averageApy}
              isPartial={summary.isPartial}
            />
            <SummaryMetric
              claimable
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
          </Stack>
        </Stack>
      </Card>
      {summary.excludesHidden ? (
        <Text variant="caption" tone="muted">
          {t("dashboard.overview.summary.excludes_confidential")}
        </Text>
      ) : null}
    </Stack>
  );
};
