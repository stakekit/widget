import { useTranslation } from "react-i18next";
import {
  formatRewardRatePercent,
  formatRoundedPercent,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  AnimatedNumber,
  Box,
  Card,
  Skeleton,
  Stack,
  Text,
} from "../../../../../ui/index";
import { YieldRiskRatingSummary } from "../../../../yield-summary/views";
import {
  useEarnEntry,
  useEarnYieldSelection,
} from "../../../react/use-earn-facades";
import { SelectYield } from "./select-yield";
import { SelectYieldRewardDetails } from "./select-yield-reward-details";
import { getYieldPercent } from "./yield-percent";

/** The Earn form's yield: its reward rate, the yield selection and its rewards. */
export const SelectYieldSection = ({
  alwaysShowStrategy,
  showRiskSummary,
}: {
  /** Show the yield strategy even without an output token, then a divider. */
  readonly alwaysShowStrategy: boolean;
  /** Render the risk summary below the section. */
  readonly showRiskSummary: boolean;
}) => {
  const { view: entry } = useEarnEntry();
  const { view: yieldSelection } = useEarnYieldSelection();
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (entry.appLoading || yieldSelection.isLoading) {
    return <Skeleton shape="rect" height="panel" />;
  }

  if (yieldSelection.all.length === 0) {
    return (
      <Stack align="center">
        <Text>{t("details.no_opportunities")}</Text>
      </Stack>
    );
  }

  const percent = getYieldPercent(entry.estimatedRewards);
  const getPercentText = () => {
    if (percent === null) return null;
    if (percent._tag === "Static") {
      return formatRewardRatePercent(percent.rate, locale);
    }
    return (
      <AnimatedNumber
        value={percent.ratio}
        format={(value) => formatRoundedPercent(value, locale)}
        initial={0}
      />
    );
  };

  return (
    <Stack gap={12}>
      <Card padding={16}>
        <Stack gap={4}>
          <Text variant="label" tone="muted">
            {t("details.earn")}
          </Text>

          <Stack direction="row" align="center" justify="between" gap={8}>
            <Box testId="estimated-reward__percent">
              <Text variant="display" as="p" numeric>
                {getPercentText()}
              </Text>
            </Box>

            <SelectYield />
          </Stack>

          <SelectYieldRewardDetails alwaysShowStrategy={alwaysShowStrategy} />
        </Stack>
      </Card>

      {showRiskSummary && entry.selectedStake && (
        <YieldRiskRatingSummary yieldDto={entry.selectedStake} />
      )}
    </Stack>
  );
};
