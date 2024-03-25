import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../../components";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { RewardTokenDetails } from "../../../../../components/molecules/reward-token-details";
import { apyVariable, apyVariableTooltip, apyYield } from "../../styles.css";
import { SelectOpportunity } from "./select-opportunity";
import { useDetailsContext } from "../../state/details-context";
import { motion } from "framer-motion";
import { useAnimateYieldPercent } from "./use-animate-yield-percent";
import { TokenIcon } from "../../../../../components/atoms/token-icon";

export const SelectYieldSection = () => {
  const {
    appLoading,
    multiYieldsLoading,
    yieldOpportunityLoading,
    tokenBalancesScanLoading,
    stakeTokenAvailableAmountLoading,
    selectedStakeData,
    rewardToken,
    estimatedRewards,
    symbol,
    selectedStake,
    defaultTokensIsLoading,
    pointsRewardTokens,
  } = useDetailsContext();

  const { t } = useTranslation();

  const isLoading =
    appLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    tokenBalancesScanLoading ||
    stakeTokenAvailableAmountLoading ||
    defaultTokensIsLoading;

  const earnYearly = estimatedRewards.mapOrDefault(
    (e) => `${e.yearly} ${symbol}`,
    ""
  );
  const earnMonthly = estimatedRewards.mapOrDefault(
    (e) => `${e.monthly} ${symbol}`,
    ""
  );

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
            <Box my="2">
              <Text>{t("details.earn")}</Text>
            </Box>

            <Box
              background="stakeSectionBackground"
              borderRadius="xl"
              marginTop="2"
              py="4"
              px="4"
            >
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

              <Box>
                <Box my="4">
                  <RewardTokenDetails rewardToken={rewardToken} type="stake" />
                </Box>

                <Box display="flex" flexDirection="column" gap="2">
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    data-testid="estimated-reward__yearly"
                  >
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {t("shared.yearly")}
                    </Text>
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {earnYearly}
                    </Text>
                  </Box>

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    data-testid="estimated-reward__monthly"
                  >
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {t("shared.monthly")}
                    </Text>
                    <Text variant={{ type: "muted", weight: "normal" }}>
                      {earnMonthly}
                    </Text>
                  </Box>

                  {pointsRewardTokens
                    .filter((val) => !!val.length)
                    .map((val) => (
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        data-testid="estimated-reward__points"
                        gap="2"
                      >
                        <Text variant={{ type: "muted", weight: "normal" }}>
                          {t("shared.points")}
                        </Text>

                        <Box display="flex" gap="1">
                          {val.map((v, i) => (
                            <Box
                              key={i}
                              background="background"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              borderRadius="lg"
                              px="2"
                              py="1"
                              gap="2"
                            >
                              <TokenIcon
                                token={v}
                                hideNetwork
                                tokenLogoHw="5"
                              />

                              <Text
                                variant={{ type: "muted", weight: "normal" }}
                              >
                                {v.name.replace(/points/i, "")}
                              </Text>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    ))
                    .extractNullable()}
                </Box>
              </Box>
            </Box>
          </Box>
        );
      })
      .extractNullable()
  );
};
