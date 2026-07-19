import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../domain/types/pending-action";
import { getExtendedYieldType } from "../../../../domain/types/yields";
import { getRewardRateFormatted } from "../../../../shared/lib/formatters";
import { Box } from "../../../../shared/ui/primitives/box";
import { Button } from "../../../../shared/ui/primitives/button";
import { Spinner } from "../../../../shared/ui/primitives/spinner";
import { Heading } from "../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { KycGateCard } from "../../../earn/ui/components/kyc-gate-card";
import { RewardRateBreakdown } from "../../../earn/ui/components/reward-rate-breakdown";
import { SelectValidator } from "../../../earn/ui/components/select-validator";
import { useTrackPage } from "../../../tracking/react/use-track-page";
import { AnimationPage } from "../../../widget-shell/animation-page";
import { PageContainer } from "../../../widget-shell/page-container";
import { TokenIcon } from "../../../widget-shell/ui/token-icon";
import { AmountBlock } from "./components/amount-block";
import { PositionBalances } from "./components/position-balances";
import { ProviderDetails } from "./components/provider-details";
import { StaticActionBlock } from "./components/static-action-block";
import { usePositionDetails } from "./hooks/use-position-details";
import { container } from "./styles.css";

const PositionDetails = () => {
  const {
    onPendingActionAmountChange,
    integrationData: integrationDataValue,
    validatorsData,
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
    isLoading,
    reducedStakedOrLiquidBalance: reducedStakedOrLiquidBalanceValue,
    positionBalancesByType: positionBalancesByTypeValue,
    onUnstakeAmountChange,
    unstakeAmount,
    unstakeFormattedAmount,
    canChangeUnstakeAmount: canChangeUnstakeAmountValue,
    onMaxClick,
    onUnstakeClick,
    unstakeDisabled,
    onPendingActionClick,
    pendingActions: pendingActionsValue,
    providersDetails,
    shareToAmountConversions: shareToAmountConversionsValue,
    validatorAddressesHandling,
    onValidatorsSubmit,
    unstakeToken: unstakeTokenValue,
    canUnstake,
    unstakeAmountError,
    unstakeMaxAmount: unstakeMaxAmountValue,
    unstakeMinAmount: unstakeMinAmountValue,
    unstakeIsGreaterOrLessIntegrationLimitError,
    kycGate,
    kycGateIsChecking,
    kycProviderName,
    onKycStatusRefresh,
    personalizedRewardRate,
    apyCompositionRewardRate,
    apyCompositionShowsUpToCampaign,
  } = usePositionDetails();

  useTrackPage("positionDetails", {
    yield: integrationDataValue?.metadata.name,
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
        ) : integrationDataValue && positionBalancesByTypeValue ? (
          <Box
            className={container}
            flex={1}
            display="flex"
            flexDirection="column"
            gap="1"
          >
            {(() => {
              const token = unstakeTokenValue ?? integrationDataValue.token;
              return (
                <>
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                  >
                    <TokenIcon
                      metadata={{
                        logoURI: integrationDataValue.metadata.logoURI,
                        name: integrationDataValue.metadata.name,
                        provider: integrationDataValue.provider,
                      }}
                      token={token}
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
                      {integrationDataValue.metadata.name}
                    </Heading>
                    <Text variant={{ type: "muted" }}>{token.symbol}</Text>
                  </Box>
                </>
              );
            })()}

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
              {providersDetails?.map((p, idx) => (
                <ProviderDetails
                  {...p}
                  key={p.address ?? idx}
                  isFirst={idx === 0}
                  rewardRate={personalizedRewardRate ? undefined : p.rewardRate}
                  rewardType={personalizedRewardRate ? undefined : p.rewardType}
                  stakeType={t(
                    `position_details.stake_type.${getExtendedYieldType(integrationDataValue)}`
                  )}
                  integrationData={integrationDataValue}
                />
              ))}
            </Box>

            <Box py="3" gap="2" display="flex" flexDirection="column">
              {[...positionBalancesByTypeValue.values()].flatMap(
                (yieldBalance) =>
                  yieldBalance.map((yb, i) => (
                    <PositionBalances
                      key={`${yb.type}-${i}`}
                      integrationData={integrationDataValue}
                      yieldBalance={yb}
                    />
                  ))
              )}
            </Box>
            {shareToAmountConversionsValue ? (
              <Box
                my="2"
                display="flex"
                alignItems="flex-end"
                flexDirection="column"
                gap="1"
              >
                {[...shareToAmountConversionsValue.values()].map((v) => (
                  <Text variant={{ type: "muted", weight: "normal" }} key={v}>
                    {v}
                  </Text>
                ))}
              </Box>
            ) : null}

            <Box
              display="flex"
              flex={1}
              justifyContent="flex-end"
              flexDirection="column"
              marginTop="10"
              gap="2"
            >
              {/* Pending actions */}
              {pendingActionsValue?.map((val) =>
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
                    yieldId={integrationDataValue.id}
                  />
                )
              )}
              {/* Unstake */}
              {reducedStakedOrLiquidBalanceValue &&
              canChangeUnstakeAmountValue !== null &&
              unstakeTokenValue ? (
                <>
                  {(kycGate.state !== "pass" || kycGateIsChecking) && (
                    <KycGateCard
                      gate={kycGate}
                      isChecking={kycGateIsChecking}
                      onCheckStatus={onKycStatusRefresh}
                      providerName={kycProviderName}
                    />
                  )}

                  <AmountBlock
                    unstakeMaxAmount={unstakeMaxAmountValue}
                    unstakeMinAmount={unstakeMinAmountValue}
                    unstakeIsGreaterOrLessIntegrationLimitError={
                      unstakeIsGreaterOrLessIntegrationLimitError
                    }
                    variant="unstake"
                    canUnstake={canUnstake}
                    unstakeToken={unstakeTokenValue}
                    onAmountChange={onUnstakeAmountChange}
                    value={unstakeAmount}
                    canChangeAmount={canChangeUnstakeAmountValue}
                    disabled={unstakeDisabled}
                    onClick={onUnstakeClick}
                    unstakeAmountError={unstakeAmountError}
                    onMaxClick={onMaxClick}
                    label={t(
                      `position_details.unstake_label.${getExtendedYieldType(integrationDataValue)}`
                    )}
                    formattedAmount={unstakeFormattedAmount}
                    balance={reducedStakedOrLiquidBalanceValue}
                    yieldDto={integrationDataValue}
                    validators={providersDetails ?? []}
                  />
                </>
              ) : null}
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
                selectedStake={integrationDataValue}
                validators={validatorsData}
                hasMore={hasMoreValidators}
                isLoadingMore={isLoadingMoreValidators}
                onLoadMore={onLoadMoreValidators}
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
        ) : null}
      </PageContainer>
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetails />;
