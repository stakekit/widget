import { Just, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../components/atoms/box";
import { Button } from "../../components/atoms/button";
import { Spinner } from "../../components/atoms/spinner";
import { TokenIcon } from "../../components/atoms/token-icon";
import { Heading } from "../../components/atoms/typography/heading";
import { Text } from "../../components/atoms/typography/text";
import { RewardRateBreakdown } from "../../components/molecules/reward-rate-breakdown";
import { SelectValidator } from "../../components/molecules/select-validator";
import { getRewardTypeFromRateType } from "../../domain/types/reward-rate";
import {
  getBaseYieldType,
  getYieldProviderDetails,
} from "../../domain/types/yields";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { AnimationPage } from "../../navigation/containers/animation-page";
import type { YieldPendingActionType } from "../../providers/yield-api-client-provider/types";
import { getRewardRateFormatted } from "../../utils/formatters";
import { PageContainer } from "../components/page-container";
import { AmountBlock } from "./components/amount-block";
import { PositionBalances } from "./components/position-balances";
import { ProviderDetails } from "./components/provider-details";
import { StaticActionBlock } from "./components/static-action-block";
import { usePositionDetails } from "./hooks/use-position-details";
import { UnstakeOrPendingActionProvider } from "./state";
import { container } from "./styles.css";

const PositionDetails = () => {
  const {
    onPendingActionAmountChange,
    integrationData,
    validatorsData,
    isLoading,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    onUnstakeAmountChange,
    unstakeAmount,
    unstakeFormattedAmount,
    canChangeUnstakeAmount,
    onMaxClick,
    onUnstakeClick,
    unstakeDisabled,
    onPendingActionClick,
    pendingActions,
    providersDetails,
    shareToAmountConversions,
    validatorAddressesHandling,
    onValidatorsSubmit,
    unstakeToken,
    canUnstake,
    unstakeAmountError,
    unstakeMaxAmount,
    unstakeMinAmount,
    unstakeIsGreaterOrLessIntegrationLimitError,
    personalizedRewardRate,
    apyCompositionRewardRate,
    apyCompositionShowsUpToCampaign,
  } = usePositionDetails();

  useTrackPage("positionDetails", {
    yield: integrationData.map((i) => i.metadata.name).extract(),
  });

  const { t } = useTranslation();

  return (
    <AnimationPage>
      <PageContainer>
        {isLoading ? (
          <Box
            className={container}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            <Spinner />
          </Box>
        ) : (
          Maybe.fromRecord({ integrationData, positionBalancesByType })
            .map(({ integrationData, positionBalancesByType }) => (
              <Box
                className={container}
                flex={1}
                display="flex"
                flexDirection="column"
                gap="1"
              >
                {unstakeToken
                  .altLazy(() => Just(integrationData.token))
                  .map((t) => (
                    <>
                      <Box
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                      >
                        <TokenIcon
                          metadata={{
                            logoURI: integrationData.metadata.logoURI,
                            name: integrationData.metadata.name,
                            provider:
                              getYieldProviderDetails(integrationData) ??
                              undefined,
                          }}
                          token={t}
                          tokenLogoHw="14"
                        />
                      </Box>
                      <Box
                        marginTop="3"
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                        flexDirection="column"
                      >
                        <Heading variant={{ level: "h4" }} textAlign="center">
                          {integrationData.metadata.name}
                        </Heading>
                        <Text variant={{ type: "muted" }}>{t.symbol}</Text>
                      </Box>
                    </>
                  ))
                  .extractNullable()}

                {personalizedRewardRate ? (
                  <Box marginTop="4">
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gap="3"
                    >
                      <Text variant={{ type: "muted", weight: "normal" }}>
                        {t("position_details.personalized_apy")}
                      </Text>

                      <Heading
                        variant={{ level: "h4" }}
                        data-testid="personalized-reward-rate"
                      >
                        {getRewardRateFormatted({
                          rewardRate: personalizedRewardRate.total,
                          rewardType: getRewardTypeFromRateType(
                            personalizedRewardRate.rateType
                          ),
                        })}
                      </Heading>
                    </Box>

                    <RewardRateBreakdown
                      rewardRate={personalizedRewardRate}
                      title={t("details.apy_composition.title")}
                      testId="personalized-reward-rate-breakdown"
                    />
                  </Box>
                ) : null}

                {!personalizedRewardRate && apyCompositionRewardRate ? (
                  <Box marginTop="4">
                    <RewardRateBreakdown
                      rewardRate={apyCompositionRewardRate}
                      showUpToCampaign={apyCompositionShowsUpToCampaign}
                      title={t("details.apy_composition.title")}
                      testId="reward-rate-breakdown"
                    />
                  </Box>
                ) : null}

                <Box marginTop="4">
                  {providersDetails
                    .map((pd) =>
                      pd.map((p, idx) => (
                        <ProviderDetails
                          {...p}
                          key={p.address ?? idx}
                          isFirst={idx === 0}
                          rewardRate={
                            personalizedRewardRate ? undefined : p.rewardRate
                          }
                          rewardType={
                            personalizedRewardRate ? undefined : p.rewardType
                          }
                          stakeType={t(
                            `position_details.stake_type.${getBaseYieldType(integrationData)}`
                          )}
                          integrationData={integrationData}
                        />
                      ))
                    )
                    .extractNullable()}
                </Box>

                <Box py="3" gap="2" display="flex" flexDirection="column">
                  {[...positionBalancesByType.values()].flatMap(
                    (yieldBalance) =>
                      yieldBalance.map((yb, i) => (
                        <PositionBalances
                          key={`${yb.type}-${i}`}
                          integrationData={integrationData}
                          yieldBalance={yb}
                        />
                      ))
                  )}
                </Box>
                {shareToAmountConversions
                  .map((val) => (
                    <Box
                      my="2"
                      display="flex"
                      alignItems="flex-end"
                      flexDirection="column"
                      gap="1"
                    >
                      {[...val.values()].map((v) => (
                        <Text
                          variant={{ type: "muted", weight: "normal" }}
                          key={v}
                        >
                          {v}
                        </Text>
                      ))}
                    </Box>
                  ))
                  .extractNullable()}

                <Box
                  display="flex"
                  flex={1}
                  justifyContent="flex-end"
                  flexDirection="column"
                  marginTop="10"
                  gap="2"
                >
                  {/* Pending actions */}
                  {pendingActions
                    .map((val) =>
                      val.map((val) =>
                        val.amount ? (
                          <AmountBlock
                            key={`${val.pendingActionDto.type}-${val.pendingActionDto.passthrough}`}
                            variant="action"
                            onAmountChange={(amount) =>
                              onPendingActionAmountChange({
                                balanceType: val.yieldBalance.type,
                                token: val.yieldBalance.token,
                                actionType: val.pendingActionDto.type,
                                amount,
                              })
                            }
                            value={val.amount}
                            canChangeAmount
                            onClick={() =>
                              onPendingActionClick({
                                pendingActionDto: val.pendingActionDto,
                                yieldBalance: val.yieldBalance,
                              })
                            }
                            label={t(
                              `position_details.pending_action_button.${
                                val.pendingActionDto.type.toLowerCase() as Lowercase<YieldPendingActionType>
                              }`
                            )}
                            onMaxClick={null}
                            formattedAmount={val.formattedAmount}
                            balance={null}
                          />
                        ) : (
                          <StaticActionBlock
                            {...val}
                            key={`${val.pendingActionDto.type}-${val.pendingActionDto.passthrough}`}
                            onPendingActionClick={onPendingActionClick}
                            yieldId={integrationData.id}
                          />
                        )
                      )
                    )
                    .extractNullable()}
                  {/* Unstake */}
                  {Maybe.fromRecord({
                    reducedStakedOrLiquidBalance,
                    canChangeUnstakeAmount,
                    unstakeToken,
                  })
                    .map(
                      ({
                        reducedStakedOrLiquidBalance,
                        canChangeUnstakeAmount,
                        unstakeToken,
                      }) => (
                        <AmountBlock
                          unstakeMaxAmount={unstakeMaxAmount}
                          unstakeMinAmount={unstakeMinAmount}
                          unstakeIsGreaterOrLessIntegrationLimitError={
                            unstakeIsGreaterOrLessIntegrationLimitError
                          }
                          variant="unstake"
                          canUnstake={canUnstake}
                          unstakeToken={unstakeToken}
                          onAmountChange={onUnstakeAmountChange}
                          value={unstakeAmount}
                          canChangeAmount={canChangeUnstakeAmount}
                          disabled={unstakeDisabled}
                          onClick={onUnstakeClick}
                          unstakeAmountError={unstakeAmountError}
                          onMaxClick={onMaxClick}
                          label={t(
                            `position_details.unstake_label.${getBaseYieldType(integrationData)}`
                          )}
                          formattedAmount={unstakeFormattedAmount}
                          balance={reducedStakedOrLiquidBalance}
                          yieldDto={integrationData}
                          validators={providersDetails.orDefault([])}
                        />
                      )
                    )
                    .extractNullable()}
                </Box>
                {validatorAddressesHandling.showValidatorsModal && (
                  <SelectValidator
                    selectedValidators={
                      validatorAddressesHandling.selectedValidators
                    }
                    onItemClick={(val) => {
                      validatorAddressesHandling.onItemClick(val.address);

                      if (validatorAddressesHandling.multiSelect) return;

                      onValidatorsSubmit([val.address]);
                    }}
                    selectedStake={integrationData}
                    validators={validatorsData}
                    multiSelect={validatorAddressesHandling.multiSelect}
                    state={validatorAddressesHandling.modalState}
                  >
                    {validatorAddressesHandling.multiSelect && (
                      <Box
                        px="4"
                        paddingTop="3"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                      >
                        <Button
                          variant={{
                            color: validatorAddressesHandling.submitDisabled
                              ? "disabled"
                              : "primary",
                          }}
                          disabled={validatorAddressesHandling.submitDisabled}
                          onClick={() =>
                            onValidatorsSubmit([
                              ...validatorAddressesHandling.selectedValidators.values(),
                            ])
                          }
                        >
                          {t("position_details.select_validators.submit")}
                        </Button>
                      </Box>
                    )}
                  </SelectValidator>
                )}
              </Box>
            ))
            .extractNullable()
        )}
      </PageContainer>
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => (
  <UnstakeOrPendingActionProvider>
    <PositionDetails />
  </UnstakeOrPendingActionProvider>
);
