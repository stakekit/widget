import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { combineRecipeWithVariant } from "../../../../../shared/styles/recipe-variant";
import { Divider } from "../../../../../shared/ui/components/divider";
import { Box } from "../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { useWidgetConfig } from "../../../../widget-configuration/index";
import { YieldRiskRatingSummary } from "../../../../yield-summary/views";
import {
  useEarnEntry,
  useEarnYieldSelection,
} from "../../../react/use-earn-facades";
import { SelectOpportunity } from "./select-opportunity";
import { SelectYieldRewardDetails } from "./select-yield-reward-details";
import { apyYield, selectYieldSection } from "./styles.css";
import { useAnimateYieldPercent } from "./use-animated-yield-percent-boundary";

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

  const { earnPresentation } = useWidgetConfig("hostProfile");
  const variant = useWidgetConfig("variant");

  const { t } = useTranslation();

  const isLoading = entry.appLoading || yieldSelection.isLoading;

  const yieldPerc = useAnimateYieldPercent(entry.estimatedRewards);
  const riskSummary = entry.selectedStake ? (
    <YieldRiskRatingSummary yieldDto={entry.selectedStake} />
  ) : null;
  const showSectionTitle =
    !earnPresentation.condensed && !earnPresentation.zerion;
  const opportunityCount = yieldSelection.all.length;

  if (isLoading) {
    return (
      <Box marginTop="2">
        <ContentLoaderSquare heightPx={112.5} />
      </Box>
    );
  }

  if (opportunityCount === 0) {
    return (
      <Box my="4" display="flex" justifyContent="center" alignItems="center">
        <Text>{t("details.no_opportunities")}</Text>
      </Box>
    );
  }

  return (
    <Box>
      {showSectionTitle && (
        <Box my="2">
          <Text>{t("details.earn")}</Text>
        </Box>
      )}

      <Box
        data-rk="stake-yield-section"
        background="stakeSectionBackground"
        borderRadius="xl"
        marginTop="2"
        py="4"
        px="4"
        className={combineRecipeWithVariant({
          rec: selectYieldSection,
          variant,
        })}
      >
        {earnPresentation.zerion && (
          <Box my="1">
            <Text>{t("details.earn")}</Text>
          </Box>
        )}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box minWidth="0" display="flex" marginRight="2" flex={1}>
            <Box position="relative" data-testid="estimated-reward__percent">
              <motion.div className={apyYield}>{yieldPerc}</motion.div>
            </Box>
          </Box>

          <Box display="flex" justifyContent="center" alignItems="center">
            <SelectOpportunity />
          </Box>
        </Box>

        {!earnPresentation.zerion && (
          <SelectYieldRewardDetails alwaysShowStrategy={alwaysShowStrategy} />
        )}
      </Box>

      {!earnPresentation.zerion && showRiskSummary && riskSummary}

      {earnPresentation.zerion && (
        <Box display="flex" flexDirection="column" gap="3">
          <SelectYieldRewardDetails alwaysShowStrategy={alwaysShowStrategy} />

          {showRiskSummary && riskSummary}

          <Divider />
        </Box>
      )}
    </Box>
  );
};
