import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { YieldPendingActionType } from "../../../../../domain/types/pending-action";
import { getExtendedYieldType } from "../../../../../domain/types/yields";
import { humanizePendingActionType } from "../../../../../shared/lib/formatters";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Button } from "../../../../../shared/ui/primitives/button";
import { Spinner } from "../../../../../shared/ui/primitives/spinner";
import { KycGateCard } from "../../../../earn/ui/components/kyc-gate-card";
import { SelectValidator } from "../../../../earn/ui/components/select-validator";
import { type PageCta, PageCtaButton } from "../../../../widget-shell/page-cta";
import {
  AmountBlock,
  UnstakeInfo,
} from "../../classic/components/amount-block";
import { StaticActionBlock } from "../../classic/components/static-action-block";
import { usePositionDetails } from "../../classic/hooks/use-position-details";
import { PositionDetailsActionTabs } from "./position-details-action-tabs";
import { container } from "./styles.css";

export const positionDetailsStakeHasContent = (
  val: ReturnType<typeof usePositionDetails>
) => val.integrationData?.status.enter ?? false;

export const positionDetailsActionsHasContent = (
  val: ReturnType<typeof usePositionDetails>
) =>
  !!val.integrationData &&
  !!val.positionBalancesByType &&
  (!!val.pendingActions?.length ||
    (!!val.reducedStakedOrLiquidBalance &&
      val.canChangeUnstakeAmount !== null &&
      !!val.unstakeToken));

export const PositionDetailsActions = () => {
  const {
    isLoading,
    integrationData: integrationDataValue,
    validatorsData,
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
    positionBalancesByType: positionBalancesByTypeValue,
    unstakeToken: unstakeTokenValue,
    providersDetails,
    pendingActions: pendingActionsValue,
    unstakeMaxAmount: unstakeMaxAmountValue,
    unstakeMinAmount: unstakeMinAmountValue,
    unstakeIsGreaterOrLessIntegrationLimitError,
    unstakeAmount,
    unstakeFormattedAmount,
    onPendingActionAmountChange,
    onPendingActionClick,
    onUnstakeAmountChange,
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
  } = usePositionDetails();

  const { t } = useTranslation();
  const unstakeCta = useMemo<PageCta>(() => {
    if (
      isLoading ||
      !integrationDataValue ||
      !reducedStakedOrLiquidBalanceValue ||
      canChangeUnstakeAmountValue === null ||
      !unstakeTokenValue
    ) {
      return null;
    }
    return {
      disabled: unstakeDisabled,
      isLoading: false,
      label: t(
        `position_details.unstake_label.${getExtendedYieldType(integrationDataValue)}`
      ),
      onClick: onUnstakeClick,
    };
  }, [
    canChangeUnstakeAmountValue,
    integrationDataValue,
    isLoading,
    onUnstakeClick,
    reducedStakedOrLiquidBalanceValue,
    t,
    unstakeDisabled,
    unstakeTokenValue,
  ]);

  if (isLoading) {
    return (
      <Box
        className={container}
        display="flex"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner />
      </Box>
    );
  }

  if (!integrationDataValue || !positionBalancesByTypeValue) return null;
  return (
    <Box
      className={container}
      flex={1}
      display="flex"
      flexDirection="column"
      marginTop="3"
    >
      <Box display="flex" flex={1} flexDirection="column" gap="3">
        <PositionDetailsActionTabs
          canStake={integrationDataValue.status.enter}
          canUnstake
        />

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
                }`,
                {
                  defaultValue: humanizePendingActionType(
                    val.pendingActionDto.type
                  ),
                }
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
              showUnstakeInfo={false}
              ctaPlacement="footer"
            />

            <UnstakeInfo
              unstakeToken={unstakeTokenValue}
              validators={providersDetails ?? []}
              yieldDto={integrationDataValue}
            />

            <PageCtaButton cta={unstakeCta} />
          </>
        ) : null}
      </Box>

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
    </Box>
  );
};
