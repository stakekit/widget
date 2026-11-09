import { useTranslation } from "react-i18next";
import {
  formatUsd,
  getRoundedPercentParts,
  unavailableFigure,
} from "../../../../../shared/lib/number-format";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  AnimatedNumber,
  Box,
  Card,
  Stack,
  Text,
} from "../../../../../ui/index";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import {
  getEstimatedRewardsUsd,
  getYieldFigures,
} from "../../../../yield-summary/index";
import { YieldRiskRatingSummary } from "../../../../yield-summary/views";
import {
  useEarnEntry,
  useEarnYieldSelection,
} from "../../../react/use-earn-facades";
import { EarnCardSkeleton } from "../earn-form-skeleton";
import { SelectYield } from "./select-yield";
import { SelectYieldRewardDetails } from "./select-yield-reward-details";
import { getYieldPercent } from "./yield-percent";

/**
 * The Earn form's yield: its reward rate under the amount, in the title's
 * size with what the amount would earn a year in USD, the yield selection
 * and its rewards.
 */
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
  const {
    earnPresentation: { yieldTitle },
  } = useWidgetConfig("hostProfile");

  if (entry.appLoading || yieldSelection.isLoading) {
    return <EarnCardSkeleton />;
  }

  if (yieldSelection.all.length === 0) {
    return (
      <Stack align="center">
        <Text>{t("details.no_opportunities")}</Text>
      </Stack>
    );
  }

  // The rate and its type both come from the yield's one figures model, so
  // the form reads as the yield's list row, picker row and details do.
  const rate = entry.selectedStake
    ? getYieldFigures({
        yieldDto: entry.selectedStake,
        selectedValidators: entry.selectedValidators,
        locale,
        t,
      }).rate
    : null;
  const getPercentText = () => {
    if (!entry.selectedStake) return null;
    if (!rate) return unavailableFigure;
    const percent = getYieldPercent(rate);
    if (percent._tag === "Static") return percent.text;
    return (
      <AnimatedNumber
        value={percent.ratio}
        {...getRoundedPercentParts(locale)}
      />
    );
  };
  const rateLabel = rate?.label ?? null;
  // A zero or missing rate reads muted.
  const rateMuted = !rate?.ratio.isPositive();
  const rewardsUsd = entry.amountEntered
    ? getEstimatedRewardsUsd({
        amountUsd: entry.priceUsd,
        estimatedRewards: entry.estimatedRewards,
      })
    : null;

  const title = (
    <Text
      variant={yieldTitle === "inside" ? "label" : "body"}
      tone={yieldTitle === "inside" ? "muted" : "default"}
      weight="medium"
    >
      {t("details.earn")}
    </Text>
  );

  return (
    <Stack gap={12}>
      <Stack gap={8}>
        {yieldTitle === "above" && title}
        <Card padding={16}>
          {/* The amount card's row gap, so both cards space alike. */}
          <Stack gap={6}>
            {yieldTitle === "inside" && title}
            <Stack direction="row" align="center" justify="between" gap={8}>
              <Stack gap={2}>
                <Stack direction="row" align="baseline" gap={6} wrap>
                  <Box testId="estimated-reward__percent">
                    <Text
                      variant="title"
                      as="p"
                      tone={rateMuted ? "muted" : "default"}
                      numeric
                    >
                      {getPercentText()}
                    </Text>
                  </Box>
                  {rateLabel && (
                    <Text variant="caption" tone="muted">
                      {rateLabel}
                    </Text>
                  )}
                </Stack>
                {/* Held until known, so typing never grows the card. */}
                <Box testId="estimated-reward__usd-yearly">
                  <Text
                    variant="caption"
                    tone={rewardsUsd ? "success" : "muted"}
                    numeric
                  >
                    {rewardsUsd
                      ? t("details.rewards.usd_per_year", {
                          amount: formatUsd(rewardsUsd.yearly, locale),
                        })
                      : unavailableFigure}
                  </Text>
                </Box>
              </Stack>

              <SelectYield />
            </Stack>

            <SelectYieldRewardDetails alwaysShowStrategy={alwaysShowStrategy} />
          </Stack>
        </Card>
      </Stack>

      {showRiskSummary && entry.selectedStake && (
        <YieldRiskRatingSummary yieldDto={entry.selectedStake} />
      )}
    </Stack>
  );
};
