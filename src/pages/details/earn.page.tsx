import { Text } from "../../components/atoms/typography";
import { Box } from "../../components/atoms/box";
import { Divider } from "../../components/atoms/divider";
import { PageContainer } from "../components";
import { useTranslation } from "react-i18next";
import { Button, NumberInput, Spinner } from "../../components";
import { useDetails } from "./hooks/use-details";
import { Footer } from "./components/footer";
import { RewardTokenDetails } from "../../components/molecules/reward-token-details";
import { SelectOpportunity } from "./components/select-opportunity";
import { SelectValidator } from "./components/select-validator";
import { pressAnimation } from "../../components/atoms/button/styles.css";
import { HelpModal } from "../../components/molecules/help-modal";
import { ConnectButton } from "../../components/molecules/connect-button";

export const EarnPage = () => {
  const {
    availableTokens,
    formattedPrice,
    selectedStakeData,
    onItemSelect,
    selectedStake,
    onStakeAmountChange,
    estimatedRewards,
    symbol,
    yieldType,
    onMaxClick,
    stakeAmount,
    tokenAvailableAmountIsFetching,
    buttonDisabled,
    onClick,
    footerItems,
    onSearch,
    onValidatorSelect,
    selectedValidator,
    isError,
    errorMessage,
    rewardToken,
    onSelectOpportunityClose,
    onStakeEnterIsLoading,
    selectedStakeYieldType,
    isFetching,
    amountValid,
    isConnected,
    onEndReached,
    opsIsFetchingNextPage,
  } = useDetails();

  const { t } = useTranslation();

  const earnYearly = estimatedRewards.mapOrDefault(
    (e) => `${e.yearly} ${symbol}`,
    ""
  );
  const earnMonthly = estimatedRewards.mapOrDefault(
    (e) => `${e.monthly} ${symbol}`,
    ""
  );
  const earnPercentage = estimatedRewards.mapOrDefault(
    (e) => `${e.percentage}%`,
    ""
  );

  const title = yieldType;

  return (
    <PageContainer>
      <Box>
        <Box>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center" minHeight="8">
              <Text variant={{ size: "small" }}>{title}</Text>
              {isFetching && (
                <Box display="flex" marginLeft="2">
                  <Spinner />
                </Box>
              )}
            </Box>

            {selectedStakeYieldType && (
              <HelpModal modal={{ type: selectedStakeYieldType }} />
            )}
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
                <NumberInput
                  onChange={onStakeAmountChange}
                  value={stakeAmount}
                />
              </Box>

              <Box display="flex" justifyContent="center" alignItems="center">
                <SelectOpportunity
                  onItemSelect={onItemSelect}
                  onSearch={onSearch}
                  selectedStake={selectedStake}
                  selectedStakeData={selectedStakeData}
                  onSelectOpportunityClose={onSelectOpportunityClose}
                  onEndReached={onEndReached}
                  isLoading={opsIsFetchingNextPage}
                />
              </Box>
            </Box>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              marginTop="2"
              flexWrap="wrap"
            >
              <Box flex={1}>
                <Text
                  variant={{
                    size: "small",
                    type: "muted",
                    weight: "normal",
                  }}
                >
                  {formattedPrice}
                </Text>
              </Box>

              <Box display="flex" justifyContent="flex-end" alignItems="center">
                {tokenAvailableAmountIsFetching ? (
                  <Spinner />
                ) : (
                  <Text
                    variant={{
                      size: "small",
                      type: amountValid ? "muted" : "danger",
                      weight: "normal",
                    }}
                  >
                    {availableTokens
                      ? `${availableTokens} ${t("shared.available")}`
                      : ""}
                  </Text>
                )}
                <Box
                  as="button"
                  borderRadius="xl"
                  background="background"
                  px="2"
                  py="1"
                  marginLeft="2"
                  onClick={onMaxClick}
                  className={pressAnimation}
                >
                  <Text
                    variant={{
                      size: "small",
                      weight: "semibold",
                      type: "regular",
                    }}
                  >
                    {t("shared.max")}
                  </Text>
                </Box>
              </Box>
            </Box>
          </Box>

          <SelectValidator
            onValidatorSelect={onValidatorSelect}
            selectedValidator={selectedValidator}
            selectedStake={selectedStake}
          />

          <Box display="flex" flexDirection="column" gap="1">
            <RewardTokenDetails rewardToken={rewardToken} type="stake" />

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              marginTop="3"
              data-testid="estimated-reward__percent"
            >
              <Text variant={{ size: "small" }}>
                {t("details.estimated_reward")}
              </Text>
              <Text variant={{ size: "small" }}>{earnPercentage}</Text>
            </Box>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              data-testid="estimated-reward__yearly"
            >
              <Text
                variant={{
                  size: "small",
                  type: "muted",
                  weight: "normal",
                }}
              >
                {t("shared.yearly")}
              </Text>
              <Text
                variant={{
                  size: "small",
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
                  size: "small",
                  type: "muted",
                  weight: "normal",
                }}
              >
                {t("shared.monthly")}
              </Text>
              <Text
                variant={{
                  size: "small",
                  type: "muted",
                  weight: "normal",
                }}
              >
                {earnMonthly}
              </Text>
            </Box>
          </Box>
        </Box>

        <Divider my="4" />

        {isError && (
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            marginBottom="6"
          >
            <Text variant={{ type: "danger" }}>{errorMessage}</Text>
          </Box>
        )}

        <Footer {...footerItems} />
      </Box>
      <Box
        flex={1}
        display="flex"
        justifyContent="flex-end"
        flexDirection="column"
        marginTop="8"
      >
        {isConnected ? (
          <Button
            disabled={buttonDisabled}
            isLoading={onStakeEnterIsLoading}
            onClick={onClick}
            variant={{
              color:
                buttonDisabled || onStakeEnterIsLoading
                  ? "disabled"
                  : "primary",
              animation: "press",
            }}
          >
            {t("shared.review")}
          </Button>
        ) : (
          <ConnectButton />
        )}
      </Box>
    </PageContainer>
  );
};

export default EarnPage;
