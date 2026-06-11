import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { Divider } from "../../../../../components/atoms/divider";
import { Text } from "../../../../../components/atoms/typography/text";
import { YieldRiskRatingSummary } from "../../../../../components/molecules/yield-risk";
import { useSettings } from "../../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
import { useEarnPageContext } from "../../state/earn-page-context";
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
  } = useEarnPageContext();

  const { dashboardVariant, variant } = useSettings();

  const { t } = useTranslation();

  const isLoading = appLoading || selectYieldIsLoading;

  const yieldPerc = useAnimateYieldPercent(estimatedRewards);
  const riskSummary = selectedStake
    .map((yieldDto) => <YieldRiskRatingSummary yieldDto={yieldDto} />)
    .extractNullable();
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
    selectedStakeData
      .map((val) => {
        const opportunityCount = dashboardVariant
          ? val.filtered.length
          : val.all.length;

        return opportunityCount === 0 ? (
          <Box
            my="4"
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
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
      })
      .extractNullable()
  );
};
