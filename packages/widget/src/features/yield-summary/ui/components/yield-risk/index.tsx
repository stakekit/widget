import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/models";
import {
  getYieldRiskDisplay,
  getYieldRiskSourceLabel,
  type YieldRiskDisplay,
} from "../../../../../domain/earn/yield";
import {
  Badge,
  Card,
  InfoTip,
  Stack,
  Text,
  type Tone,
  VisuallyHidden,
} from "../../../../../ui/index";

// Green stays for positive rates, so the best ratings read in the info tone.
const riskTones = {
  positive: "info",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
} as const satisfies Record<YieldRiskDisplay["tone"], Tone>;

const YieldRiskInfoTooltip = () => {
  const { t } = useTranslation();

  return (
    <InfoTip label={t("details.risk.info_aria_label")}>
      {t("details.risk.tooltip")}
    </InfoTip>
  );
};

export const RiskRatingBadge = ({
  risk,
  testId,
}: {
  readonly risk: YieldRiskDisplay;
  readonly testId?: string;
}) => {
  const { t } = useTranslation();

  return (
    <Stack
      as="span"
      direction="row"
      align="center"
      {...(testId ? { testId } : {})}
    >
      <VisuallyHidden>{`${t("details.risk.title")}: `}</VisuallyHidden>
      <Badge tone={riskTones[risk.tone]}>{risk.rating}</Badge>
    </Stack>
  );
};

/** The rating's badge beside the info tip that explains where ratings come from. */
export const YieldRiskRatingActions = ({
  risk,
  testId,
}: {
  readonly risk: YieldRiskDisplay;
  readonly testId?: string;
}) => (
  <Stack direction="row" align="center" gap={8}>
    <RiskRatingBadge risk={risk} {...(testId ? { testId } : {})} />
    <YieldRiskInfoTooltip />
  </Stack>
);

export const YieldRiskRatingSummary = ({
  yieldDto,
}: {
  readonly yieldDto: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const risk = getYieldRiskDisplay(yieldDto);

  if (!risk) return null;

  const sourceLabel = getYieldRiskSourceLabel(risk.source, t);

  return (
    <Card testId="yield-risk-rating-summary">
      <Stack direction="row" align="center" justify="between" gap={12}>
        <Stack gap={4}>
          <Text variant="label" weight="semibold">
            {t("details.risk.title")}
          </Text>
          <Text variant="caption" tone="muted">
            {t("details.risk.rated_by", { source: sourceLabel })}
          </Text>
        </Stack>

        <YieldRiskRatingActions
          risk={risk}
          testId="yield-risk-rating-summary__badge"
        />
      </Stack>
    </Card>
  );
};
