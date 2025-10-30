import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../../../components/atoms/box";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { Divider } from "../../../../../components/atoms/divider";
import { ToolTip } from "../../../../../components/atoms/tooltip";
import { Text } from "../../../../../components/atoms/typography/text";
import { useSettings } from "../../../../../providers/settings";
import { combineRecipeWithVariant } from "../../../../../utils/styles";
import { useEarnPageContext } from "../../state/earn-page-context";
import { apyVariable, apyYield } from "../../styles.css";
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

  const { variant } = useSettings();

  const { t } = useTranslation();

  const isLoading = appLoading || selectYieldIsLoading;

  const yieldPerc = useAnimateYieldPercent(estimatedRewards);

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    selectedStakeData
      .map((val) => {
        return val.all.length === 0 ? (
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
            {variant !== "zerion" &&
              variant !== "utila" &&
              variant !== "porto" && (
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
                    {selectedStake
                      .filter((pd) => pd.rewardType === "variable")
                      .map(() => (
                        <ToolTip
                          asChild
                          maxWidth={160}
                          label={t("details.reward_rate_estimate_tooltip")}
                        >
                          <Box className={apyVariable}>
                            <Text variant={{ size: "large" }}>*</Text>
                          </Box>
                        </ToolTip>
                      ))
                      .extractNullable()}

                    <motion.div className={apyYield}>{yieldPerc}</motion.div>
                  </Box>
                </Box>

                <Box display="flex" justifyContent="center" alignItems="center">
                  <SelectOpportunity />
                </Box>
              </Box>

              {variant !== "zerion" && <SelectYieldRewardDetails />}
            </Box>

            {variant === "zerion" && (
              <Box display="flex" flexDirection="column" gap="3">
                <SelectYieldRewardDetails />

                <Divider />
              </Box>
            )}
          </Box>
        );
      })
      .extractNullable()
  );
};
