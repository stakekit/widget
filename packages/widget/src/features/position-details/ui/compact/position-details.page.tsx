import { useTranslation } from "react-i18next";
import { isCancellingBalance } from "../../../../domain/earn/confidential";
import type { EarnYieldWithProvider } from "../../../../domain/earn/models";
import { getExtendedYieldType } from "../../../../domain/earn/yield";
import { groupPositionBalanceRows } from "../../../../domain/portfolio/positions";
import { widgetRoutes } from "../../../../services/navigation/widget-routes";
import {
  formatRewardRatePercent,
  formatTokenAmount,
} from "../../../../shared/lib/number-format";
import { useTokenLogo } from "../../../../shared/react/token-logo";
import { useWidgetPresentation } from "../../../../shared/react/widget-presentation";
import {
  Box,
  Button,
  DetailList,
  Spinner,
  Stack,
  Text,
  TokenAvatar,
} from "../../../../ui/index";
import { WidgetNavigate } from "../../../navigation/views";
import { useTrackPage } from "../../../tracking/index";
import { AnimationPage, PageContainer } from "../../../widget-shell/views";
import { RewardRateBreakdown } from "../../../yield-summary/views";
import { usePositionDetails } from "../../react/use-position-details";
import { PositionDetailsExitActions } from "../components/position-details-exit-actions";
import { PositionDetailsPendingActions } from "../components/position-details-pending-actions";
import { PositionDetailsValidatorModal } from "../components/position-details-validator-modal";
import { PositionBalances } from "./components/position-balances";
import { ProviderDetails } from "./components/provider-details";
import { YieldDetails } from "./components/yield-details";

const PositionDetails = () => {
  const {
    onPendingActionAmountChange,
    integrationData: integrationDataValue,
    isLoading,
    positionBalancesByType: positionBalancesByTypeValue,
    onPendingActionClick,
    pendingActions: pendingActionsValue,
    positionLost,
    providersDetails,
    positionSource,
    shareToAmountConversions: shareToAmountConversionsValue,
    personalizedRewardRate,
    apyCompositionRewardRate,
    apyCompositionShowsUpToCampaign,
    cancellingHandles,
    hasHiddenBalances,
    hasRevealedBalances,
    onHideBalances,
    onRevealBalances,
    revealFailed,
    revealing,
  } = usePositionDetails();

  useTrackPage("positionDetails", {
    yield: integrationDataValue?.metadata.name,
  });

  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();

  if (!isLoading && positionLost) {
    return <WidgetNavigate replace to={widgetRoutes.positions.build()} />;
  }

  const balanceRows = positionBalancesByTypeValue
    ? groupPositionBalanceRows(
        [...positionBalancesByTypeValue.values()].flat(),
        (balance) => isCancellingBalance(balance, cancellingHandles)
      )
    : [];

  return (
    <AnimationPage>
      <PageContainer>
        {isLoading ? (
          <Stack grow align="center" justify="center">
            <Spinner />
          </Stack>
        ) : null}
        {!isLoading && integrationDataValue && positionBalancesByTypeValue ? (
          <Stack grow gap={4}>
            <PositionHeading integrationData={integrationDataValue} />

            {personalizedRewardRate ? (
              <Box paddingBlock={8}>
                <Stack
                  direction="row"
                  justify="between"
                  align="center"
                  gap={12}
                >
                  <Text tone="muted">
                    {t("position_details.personalized_apy")}
                  </Text>

                  <Box testId="personalized-reward-rate">
                    <Text variant="heading" as="p">
                      {formatRewardRatePercent(
                        personalizedRewardRate.total,
                        locale
                      )}
                    </Text>
                  </Box>
                </Stack>

                <RewardRateBreakdown
                  rewardRate={personalizedRewardRate}
                  title={t("details.apy_composition.title")}
                  testId="personalized-reward-rate-breakdown"
                />
              </Box>
            ) : null}

            {!personalizedRewardRate && apyCompositionRewardRate ? (
              <Box paddingBlock={8}>
                <RewardRateBreakdown
                  rewardRate={apyCompositionRewardRate}
                  showUpToCampaign={apyCompositionShowsUpToCampaign}
                  title={t("details.apy_composition.title")}
                  testId="reward-rate-breakdown"
                />
              </Box>
            ) : null}

            <Box paddingBlock={8}>
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

            <Box paddingBlock={12}>
              <Stack gap={8}>
                <DetailList>
                  {balanceRows.map((row, i) => (
                    <PositionBalances
                      key={`${row.type}-${i}`}
                      integrationData={integrationDataValue}
                      yieldBalance={row}
                    />
                  ))}
                </DetailList>
                {hasHiddenBalances ? (
                  <Stack gap={4}>
                    <Button
                      size="sm"
                      loading={revealing}
                      onClick={onRevealBalances}
                    >
                      {t("shared.confidential.reveal")}
                    </Button>
                    {revealFailed ? (
                      <Text tone="danger">
                        {t("shared.confidential.reveal_failed")}
                      </Text>
                    ) : null}
                  </Stack>
                ) : null}
                {hasRevealedBalances ? (
                  <Button size="sm" onClick={onHideBalances}>
                    {t("shared.confidential.hide")}
                  </Button>
                ) : null}
              </Stack>
            </Box>
            {shareToAmountConversionsValue ? (
              <Stack align="end" gap={4}>
                {[...shareToAmountConversionsValue].map(
                  ([tokenKey, conversion]) => (
                    <Text tone="muted" numeric key={tokenKey}>
                      {`1 ${conversion.symbol} = ${formatTokenAmount(conversion.rate, locale, "nearest")} ${conversion.shareSymbol}`}
                    </Text>
                  )
                )}
              </Stack>
            ) : null}

            <Box grow paddingBlock={24}>
              <Stack gap={8} justify="end">
                <PositionDetailsPendingActions
                  flagsInvalidAmount
                  humanizesUntranslatedLabels={false}
                  positionDetails={{
                    integrationData: integrationDataValue,
                    pendingActions: pendingActionsValue,
                    onPendingActionAmountChange,
                    onPendingActionClick,
                  }}
                />
                <PositionDetailsExitActions />
              </Stack>
            </Box>

            <PositionDetailsValidatorModal />
          </Stack>
        ) : null}
      </PageContainer>
    </AnimationPage>
  );
};

/** The position's logo, name and token, centered over its details. */
const PositionHeading = ({
  integrationData,
}: {
  readonly integrationData: EarnYieldWithProvider;
}) => {
  const token = integrationData.outputToken ?? integrationData.token;
  const logo = useTokenLogo(token, {
    metadata: {
      logoURI: integrationData.metadata.logoURI,
      name: integrationData.metadata.name,
      provider: integrationData.provider,
    },
  });

  return (
    <Stack align="center" gap={12}>
      <TokenAvatar {...logo} size="xl" decorative />
      <Stack align="center">
        <Text variant="title" as="h2" align="center">
          {integrationData.metadata.name}
        </Text>
        <Text tone="muted">{token.symbol}</Text>
      </Stack>
    </Stack>
  );
};

export const PositionDetailsPage = () => <PositionDetails />;
