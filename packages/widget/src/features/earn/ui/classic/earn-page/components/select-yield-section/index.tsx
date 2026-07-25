import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config/use-widget-config";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { Divider } from "../../../../../../widget-shell/divider";
import {
  useEarnEntry,
  useEarnYieldSelection,
} from "../../../../../react/use-earn-facades";
import { YieldRiskRatingSummary } from "../../../../components/yield-risk";
import { apyYield } from "../../styles.css";
import { SelectOpportunity } from "./select-opportunity";
import { SelectYieldRewardDetails } from "./select-yield-reward-details";
import { selectYieldSection } from "./styles.css";
import { useAnimateYieldPercent } from "./use-animated-yield-percent-boundary";

export const SelectYieldSection = () => {
  const { view: entry } = useEarnEntry();
  const { view: yieldSelection } = useEarnYieldSelection();

  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  const { t } = useTranslation();

  const isLoading = entry.appLoading || yieldSelection.isLoading;

  const yieldPerc = useAnimateYieldPercent(entry.estimatedRewards);
  const riskSummary = entry.selectedStake ? (
    <YieldRiskRatingSummary yieldDto={entry.selectedStake} />
  ) : null;
  const showSectionTitle =
    !dashboardVariant &&
    variant !== "zerion" &&
    variant !== "utila" &&
    variant !== "porto";
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
        {variant === "zerion" && (
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

        {variant !== "zerion" && <SelectYieldRewardDetails />}
      </Box>

      {variant !== "zerion" && !dashboardVariant && riskSummary}

      {variant === "zerion" && (
        <Box display="flex" flexDirection="column" gap="3">
          <SelectYieldRewardDetails />

          {!dashboardVariant && riskSummary}

          <Divider />
        </Box>
      )}
    </Box>
  );
};
