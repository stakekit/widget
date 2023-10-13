import { useTranslation } from "react-i18next";
import { Box, Text } from "../../../../../components";
import { ContentLoaderSquare } from "../../../../../components/atoms/content-loader";
import { RewardTokenDetails } from "../../../../../components/molecules/reward-token-details";
import { apyYield } from "../../styles.css";
import { SelectOpportunity } from "./select-opportunity";
import { useDetailsContext } from "../../state/details-context";

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
    providerDetails,
  } = useDetailsContext();

  const { t } = useTranslation();

  const isLoading =
    appLoading ||
    multiYieldsLoading ||
    yieldOpportunityLoading ||
    tokenBalancesScanLoading ||
    stakeTokenAvailableAmountLoading;

  const earnYearly = estimatedRewards.mapOrDefault(
    (e) => `${e.yearly} ${symbol}`,
    ""
  );
  const earnMonthly = estimatedRewards.mapOrDefault(
    (e) => `${e.monthly} ${symbol}`,
    ""
  );

  return isLoading ? (
    <Box marginTop="2">
      <ContentLoaderSquare heightPx={112.5} />
    </Box>
  ) : (
    selectedStakeData
      .map((val) =>
        val.all.length === 0 ? (
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
                  <Text className={apyYield}>
                    {providerDetails
                      .map((ss) => `${ss.aprPercentage}%`)
                      .extractNullable()}
                  </Text>
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
                    <Text
                      variant={{
                        type: "muted",
                        weight: "normal",
                      }}
                    >
                      {t("shared.yearly")}
                    </Text>
                    <Text
                      variant={{
                        type: "muted",
                        weight: "normal",
                      }}
                    >
                      {earnYearly}
                    </Text>
                  </Box>

                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    data-testid="estimated-reward__monthly"
                  >
                    <Text
                      variant={{
                        type: "muted",
                        weight: "normal",
                      }}
                    >
                      {t("shared.monthly")}
                    </Text>
                    <Text
                      variant={{
                        type: "muted",
                        weight: "normal",
                      }}
                    >
                      {earnMonthly}
                    </Text>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        )
      )
      .extractNullable()
  );
};
