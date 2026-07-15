import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useWidgetConfig } from "../../../../../../../app/config";
import { combineRecipeWithVariant } from "../../../../../../../shared/styles/recipe-variant";
import { Box } from "../../../../../../../shared/ui/primitives/box";
import { ContentLoaderSquare } from "../../../../../../../shared/ui/primitives/content-loader";
import { Text } from "../../../../../../../shared/ui/primitives/typography/text";
import { Divider } from "../../../../../../widget-shell";
import { YieldRiskRatingSummary } from "../../../../components/yield-risk";
import { useEarnPageModel } from "../../state/earn-page-model";
import { apyYield } from "../../styles.css";
import { SelectOpportunity } from "./select-opportunity";
import { SelectYieldRewardDetails } from "./select-yield-reward-details";
import { selectYieldSection } from "./styles.css";
import { useAnimateYieldPercent } from "./use-animate-yield-percent";

export const SelectYieldSection = () => {
  const {
    appLoading,
    selectedStakeData,
    estimatedRewards,
    selectedStake,
    selectYieldIsLoading,
  } = useEarnPageModel();

  const dashboardVariant = useWidgetConfig("dashboardVariant");
  const variant = useWidgetConfig("variant");

  const { t } = useTranslation();

  const isLoading = appLoading || selectYieldIsLoading;

  const yieldPerc = useAnimateYieldPercent(estimatedRewards);
  const riskSummary = selectedStake ? (
    <YieldRiskRatingSummary yieldDto={selectedStake} />
  ) : null;
  const showSectionTitle =
    !dashboardVariant &&
    variant !== "zerion" &&
    variant !== "utila" &&
    variant !== "porto";

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    (() => {
      const opportunityCount = selectedStakeData.all.length;

      return opportunityCount === 0 ? (
        <Box my="4" display="flex" justifyContent="center" alignItems="center">
          <Text>{t("details.no_opportunities")}</Text>
        </Box>
      ) : (
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
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box minWidth="0" display="flex" marginRight="2" flex={1}>
                <Box
                  position="relative"
                  data-testid="estimated-reward__percent"
                >
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
    })()
  );
};
