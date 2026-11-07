import type { TFunction } from "i18next";
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
  ExternalLink,
  InfoTip,
  Stack,
  Text,
  VisuallyHidden,
} from "../../../../../ui/index";
import { getRiskRatingTone } from "../../../model/risk-rating-tone";

/**
 * What a rater's scale measures and runs over, and where it explains it. An
 * unknown rater reads as a letter scale, without a link.
 */
const riskScale = (
  risk: YieldRiskDisplay,
  t: TFunction
): { readonly scale: string; readonly methodology?: string } => {
  switch (risk.source) {
    case "credora":
      return {
        scale: t("details.risk.scale.credora"),
        methodology:
          "https://www.credora.network/docs/methodologies/defi-rating-scale/",
      };
    case "stakingRewards":
      return {
        scale: t("details.risk.scale.staking_rewards"),
        methodology:
          "https://docs.stakingrewards.com/verified-provider-program/verification-methodology/sr-rating/provider-ratings",
      };
    default:
      return {
        scale: t("details.risk.scale.other", {
          source: getYieldRiskSourceLabel(risk.source, t),
        }),
      };
  }
};

/** What the rating's band means; a rating outside the letter bands says none. */
const gradeMeanings = {
  positive: "details.risk.grade.positive",
  warning: "details.risk.grade.warning",
  danger: "details.risk.grade.danger",
  neutral: undefined,
} as const satisfies Record<YieldRiskDisplay["tone"], string | undefined>;

/**
 * Explains the rating: what its rater's scale measures, from best to worst,
 * what this grade means on it, and a link to the rater's methodology.
 */
const YieldRiskInfoTooltip = ({
  risk,
}: {
  readonly risk: YieldRiskDisplay;
}) => {
  const { t } = useTranslation();
  const { scale, methodology } = riskScale(risk, t);
  const meaning = gradeMeanings[risk.tone];

  return (
    <InfoTip label={t("details.risk.info_aria_label")}>
      <Stack gap={8}>
        <Text as="p">{scale}</Text>
        {meaning !== undefined && (
          <Text as="p" weight="medium">
            {t(meaning, { rating: risk.rating })}
          </Text>
        )}
        <Text as="p" variant="caption" tone="muted">
          {t("details.risk.not_a_guarantee")}
        </Text>
        {methodology !== undefined && (
          <Text as="p" variant="caption">
            <ExternalLink
              href={methodology}
              newTabLabel={t("shared.opens_in_new_tab")}
            >
              {t("details.risk.methodology", {
                source: getYieldRiskSourceLabel(risk.source, t),
              })}
            </ExternalLink>
          </Text>
        )}
      </Stack>
    </InfoTip>
  );
};

const RiskRatingBadge = ({
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
      <Badge tone={getRiskRatingTone(risk)}>{risk.rating}</Badge>
    </Stack>
  );
};

/** The rating's badge beside the info tip that explains its scale and grade. */
export const YieldRiskRatingActions = ({
  risk,
  testId,
}: {
  readonly risk: YieldRiskDisplay;
  readonly testId?: string;
}) => (
  <Stack direction="row" align="center" gap={8}>
    <RiskRatingBadge risk={risk} {...(testId ? { testId } : {})} />
    <YieldRiskInfoTooltip risk={risk} />
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
