import { useTranslation } from "react-i18next";
import { getExtendedYieldType } from "../../../../../domain/types/yields";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { KycGateCard, SelectValidator } from "../../../../earn/components";
import {
  type PageCta,
  PageCtaButton,
} from "../../../../widget-shell/components";
import {
  AmountBlock,
  UnstakeInfo,
} from "../../classic/components/amount-block";
import { ExitReceiveTokenSelect } from "../../classic/components/exit-receive-token-select";
import { usePositionDetails } from "../../classic/hooks/use-position-details";

export const PositionDetailsUnstakeActions = () => {
  const {
    integrationData: integrationDataValue,
    validatorsData,
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
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
    validatorAddressesHandling,
    onValidatorsSubmit,
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

      {exitReceiveTokenSelection ? (
        <ExitReceiveTokenSelect
          onSelect={onReceiveTokenSelect}
          selection={exitReceiveTokenSelection}
        />
      ) : null}

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
      />

      <UnstakeInfo
        unstakeToken={unstakeTokenValue}
        validators={providersDetails ?? []}
        yieldDto={integrationDataValue}
      />

      <PageCtaButton cta={unstakeCta} />

      {validatorAddressesHandling.showValidatorsModal && (
        <SelectValidator
          selectedValidators={validatorAddressesHandling.selectedValidators}
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
    </>
  );
};
