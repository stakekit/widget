import { useTranslation } from "react-i18next";
import { getExtendedYieldType } from "../../../../../domain/earn/yield";
import { Box } from "../../../../../shared/ui/primitives/box";
import { KycGateCard } from "../../../../earn/views";
import { type PageCta, PageCtaButton } from "../../../../widget-shell/views";
import { usePositionDetails } from "../hooks/use-position-details";
import { AmountBlock, UnstakeInfo } from "./amount-block";
import { ExitReceiveTokenAccessory } from "./exit-receive-token-accessory";
import { ExitReceiveTokenNote } from "./exit-receive-token-note";

export const PositionDetailsUnstakeActions = () => {
  const {
    integrationData: integrationDataValue,
    unstakeToken: unstakeTokenValue,
    providersDetails,
    unstakeMaxAmount: unstakeMaxAmountValue,
    unstakeMinAmount: unstakeMinAmountValue,
    unstakeIsGreaterOrLessIntegrationLimitError,
    unstakeAmount,
    unstakeFormattedAmount,
    reducedStakedOrLiquidBalance: reducedStakedOrLiquidBalanceValue,
    canChangeUnstakeAmount: canChangeUnstakeAmountValue,
    canUnstake,
    unstakeDisabled,
    onUnstakeClick,
    unstakeAmountError,
    onMaxClick,
    kycGate,
    kycGateIsChecking,
    kycProviderName,
    onKycStatusRefresh,
    exitReceiveTokenSelection,
    onReceiveTokenSelect,
    onUnstakeAmountChange,
  } = usePositionDetails();

  const { t } = useTranslation();

  if (
    !reducedStakedOrLiquidBalanceValue ||
    canChangeUnstakeAmountValue === null ||
    !unstakeTokenValue ||
    !integrationDataValue
  ) {
    return null;
  }

  const unstakeCta: PageCta = {
    disabled: unstakeDisabled,
    isLoading: false,
    label: t(
      `position_details.unstake_label.${getExtendedYieldType(integrationDataValue)}`
    ),
    onClick: onUnstakeClick,
  };

  return (
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
        showUnstakeInfo={false}
        ctaPlacement="footer"
        tokenAccessory={
          <ExitReceiveTokenAccessory
            integration={integrationDataValue}
            onSelect={onReceiveTokenSelect}
            positionToken={unstakeTokenValue}
            selection={exitReceiveTokenSelection}
          />
        }
      />

      <Box display="flex" flexDirection="column" gap="2">
        <ExitReceiveTokenNote
          positionToken={unstakeTokenValue}
          selection={exitReceiveTokenSelection}
        />
        <UnstakeInfo
          unstakeToken={unstakeTokenValue}
          validators={providersDetails ?? []}
          yieldDto={integrationDataValue}
        />
      </Box>

      <PageCtaButton cta={unstakeCta} />
    </>
  );
};
