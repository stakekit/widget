import { useTranslation } from "react-i18next";
import {
  getYieldRiskDisplay,
  getYieldRiskSourceLabel,
  type Yield,
  type YieldRiskDisplay,
} from "../../../domain/types/yields";
import { Box } from "../../atoms/box";
import { InfoIcon } from "../../atoms/icons/info";
import { ToolTip } from "../../atoms/tooltip";
import { Text } from "../../atoms/typography/text";
import {
  riskInfoButton,
  riskRatingBadge,
  riskRatingBadgeText,
  riskSummaryActions,
  riskSummaryContainer,
} from "./styles.css";

export { riskSummaryActions } from "./styles.css";

type RiskRatingBadgeProps = {
  risk: YieldRiskDisplay;
  size?: "compact" | "default";
  testId?: string;
};

export const YieldRiskInfoTooltip = () => {
  const { t } = useTranslation();

  return (
    <ToolTip asChild label={t("details.risk.tooltip")}>
      <Box
        as="button"
        aria-label={t("details.risk.info_aria_label")}
        className={riskInfoButton}
        type="button"
      >
        <InfoIcon />
      </Box>
    </ToolTip>
  );
};

export const RiskRatingBadge = ({
  risk,
  size = "compact",
  testId,
}: RiskRatingBadgeProps) => {
  const { t } = useTranslation();

  return (
    <Box
      as="span"
      aria-label={`${t("details.risk.title")}: ${risk.rating}`}
      className={riskRatingBadge({ size, tone: risk.tone })}
      data-testid={testId}
    >
      <Box as="span" className={riskRatingBadgeText({ size, tone: risk.tone })}>
        {risk.rating}
      </Box>
    </Box>
  );
};

export const YieldRiskRatingSummary = ({ yieldDto }: { yieldDto: Yield }) => {
  const { t } = useTranslation();
  const risk = getYieldRiskDisplay(yieldDto);

  if (!risk) return null;

  const sourceLabel = getYieldRiskSourceLabel(risk.source, t);

  return (
    <Box
      background="stakeSectionBackground"
      borderRadius="xl"
      className={riskSummaryContainer}
      data-testid="yield-risk-rating-summary"
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      gap="3"
      marginTop="2"
      py="4"
      px="4"
    >
      <Box display="flex" flexDirection="column" gap="1" minWidth="0">
        <Text variant={{ weight: "bold" }}>{t("details.risk.title")}</Text>
        <Text variant={{ type: "muted", weight: "normal" }}>
          {t("details.risk.rated_by", { source: sourceLabel })}
        </Text>
      </Box>

      <Box className={riskSummaryActions}>
        <RiskRatingBadge
          risk={risk}
          size="default"
          testId="yield-risk-rating-summary__badge"
        />

        <YieldRiskInfoTooltip />
      </Box>
    </Box>
  );
};
