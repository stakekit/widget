import { useTranslation } from "react-i18next";
import { Box, Divider, Text } from "../../../../../components";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { apyVariable, apyVariableTooltip, apyYield } from "../../styles.css";
import { SelectOpportunity } from "./select-opportunity";
import { useDetailsContext } from "../../state/details-context";
import { motion } from "framer-motion";
import { useAnimateYieldPercent } from "./use-animate-yield-percent";
import { useSettings } from "../../../../../providers/settings";
import { SelectYieldRewardDetails } from "./select-yield-reward-details";

export const SelectYieldSection = () => {
  const {
    appLoading,
    multiYieldsLoading,
    yieldOpportunityLoading,
    tokenBalancesScanLoading,
    stakeTokenAvailableAmountLoading,
    selectedStakeData,
    estimatedRewards,
    selectedStake,
    defaultTokensIsLoading,
  } = useDetailsContext();

  const { variant } = useSettings();

  const { t } = useTranslation();

  const isLoading =
    appLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    tokenBalancesScanLoading ||
    stakeTokenAvailableAmountLoading ||
    defaultTokensIsLoading;

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
            {variant === "default" && (
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
            >
              {variant === "zerion" && (
                <Box my="2">
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
                        <Box className={apyVariable}>
                          <Text variant={{ size: "large" }}>*</Text>

                          <Text className={apyVariableTooltip}>
                            {t("details.reward_rate_estimate_tooltip")}
                          </Text>
                        </Box>
                      ))
                      .extractNullable()}

                    <motion.div className={apyYield}>{yieldPerc}</motion.div>
                  </Box>
                </Box>

                <Box display="flex" justifyContent="center" alignItems="center">
                  <SelectOpportunity />
                </Box>
              </Box>

              {variant === "default" && <SelectYieldRewardDetails />}
            </Box>

            {variant === "zerion" && (
              <Box display="flex" flexDirection="column" gap="5">
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
