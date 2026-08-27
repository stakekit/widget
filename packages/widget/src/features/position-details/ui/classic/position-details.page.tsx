import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../domain/action/pending-action";
import { getExtendedYieldType } from "../../../../domain/earn/yield";
import { getRewardRateFormatted } from "../../../../shared/lib/formatters";
import { TokenIcon } from "../../../../shared/ui/components/token-icon";
import { Box } from "../../../../shared/ui/primitives/box";
import { Spinner } from "../../../../shared/ui/primitives/spinner";
import { Heading } from "../../../../shared/ui/primitives/typography/heading";
import { Text } from "../../../../shared/ui/primitives/typography/text";
import { useTrackPage } from "../../../tracking/index";
import { AnimationPage, PageContainer } from "../../../widget-shell/views";
import { RewardRateBreakdown } from "../../../yield-summary/views";
import { AmountBlock } from "./components/amount-block";
import { PositionBalances } from "./components/position-balances";
import { PositionDetailsUnstakeActions } from "./components/position-details-unstake-actions";
import { PositionDetailsValidatorModal } from "./components/position-details-validator-modal";
import { ProviderDetails } from "./components/provider-details";
import { StaticActionBlock } from "./components/static-action-block";
import { YieldDetails } from "./components/yield-details";
import { usePositionDetails } from "./hooks/use-position-details";
import { container } from "./styles.css";

const PositionDetails = () => {
  const {
    onPendingActionAmountChange,
    integrationData: integrationDataValue,
    isLoading,
    positionBalancesByType: positionBalancesByTypeValue,
    onPendingActionClick,
    pendingActions: pendingActionsValue,
    providersDetails,
    positionSource,
    shareToAmountConversions: shareToAmountConversionsValue,
    unstakeToken: unstakeTokenValue,
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
        ) : null}
        {!isLoading && integrationDataValue && positionBalancesByTypeValue ? (
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
              {positionSource === "validator" ? (
                providersDetails?.map((p, idx) => (
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
                      `position_details.stake_type.${getExtendedYieldType(integrationDataValue)}`
                    )}
                    integrationData={integrationDataValue}
                  />
                ))
              ) : (
                <YieldDetails
                  integrationData={integrationDataValue}
                  showRewardRate={
                    !personalizedRewardRate && !apyCompositionRewardRate
                  }
                />
              )}
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
                    key={`${val.pendingAction.type}-${val.pendingAction.passthrough}`}
                    variant="action"
                    onAmountChange={(amount) =>
                      onPendingActionAmountChange({
                        balanceType: val.yieldBalance.type,
                        token: val.yieldBalance.token,
                        actionType: val.pendingAction.type,
                        passthrough: val.pendingAction.passthrough,
                        amount,
                      })
                    }
                    value={val.amount}
                    canChangeAmount
                    onClick={() =>
                      onPendingActionClick({
                        pendingAction: val.pendingAction,
                        yieldBalance: val.yieldBalance,
                      })
                    }
                    label={t(
                      `position_details.pending_action_button.${
                        val.pendingAction.type.toLowerCase() as Lowercase<YieldPendingActionType>
                      }`
                    )}
                    onMaxClick={null}
                    formattedAmount={val.formattedAmount}
                    balance={null}
                    unstakeAmountError={val.validation !== null}
                  />
                ) : (
                  <StaticActionBlock
                    {...val}
                    key={`${val.pendingAction.type}-${val.pendingAction.passthrough}`}
                    onPendingActionClick={onPendingActionClick}
                    yieldId={integrationDataValue.id}
                  />
                )
              )}
              {/* Unstake */}
              <PositionDetailsUnstakeActions />
            </Box>

            <PositionDetailsValidatorModal />
          </Box>
        ) : null}
      </PageContainer>
    </AnimationPage>
  );
};

export const PositionDetailsPage = () => <PositionDetails />;
