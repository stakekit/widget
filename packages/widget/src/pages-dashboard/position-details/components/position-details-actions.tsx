import { Maybe } from "purify-ts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Button } from "../../../components/atoms/button";
import { Spinner } from "../../../components/atoms/spinner";
import { KycGateCard } from "../../../components/molecules/kyc-gate-card";
import { SelectValidator } from "../../../components/molecules/select-validator";
import type { YieldPendingActionType } from "../../../domain/types/pending-action";
import { getExtendedYieldType } from "../../../domain/types/yields";
import {
  type PageCta,
  PageCtaButton,
} from "../../../pages/components/page-cta";
import {
  AmountBlock,
  UnstakeInfo,
} from "../../../pages/position-details/components/amount-block";
import { StaticActionBlock } from "../../../pages/position-details/components/static-action-block";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { PositionDetailsActionTabs } from "./position-details-action-tabs";
import { container } from "./styles.css";

export const positionDetailsStakeHasContent = (
  val: ReturnType<typeof usePositionDetails>
) =>
  val.integrationData.mapOrDefault((yieldDto) => yieldDto.status.enter, false);

export const positionDetailsActionsHasContent = (
  val: ReturnType<typeof usePositionDetails>
) =>
  Maybe.fromRecord({
    integrationData: val.integrationData,
    positionBalancesByType: val.positionBalancesByType,
  })
    .filter(
      () =>
        Maybe.catMaybes([
          val.pendingActions.filter((pa) => pa.length > 0).map(() => true),
          Maybe.fromRecord({
            reducedStakedOrLiquidBalance: val.reducedStakedOrLiquidBalance,
            canChangeUnstakeAmount: val.canChangeUnstakeAmount,
            unstakeToken: val.unstakeToken,
          }).map(() => true),
        ]).length > 0
    )
    .isJust();

export const PositionDetailsActions = () => {
  const {
    isLoading,
    integrationData,
    validatorsData,
    hasMoreValidators,
    isLoadingMoreValidators,
    onLoadMoreValidators,
    positionBalancesByType,
    unstakeToken,
    providersDetails,
    pendingActions,
    unstakeMaxAmount,
    unstakeMinAmount,
    unstakeIsGreaterOrLessIntegrationLimitError,
    unstakeAmount,
    unstakeFormattedAmount,
    onPendingActionAmountChange,
    onPendingActionClick,
    onUnstakeAmountChange,
    reducedStakedOrLiquidBalance,
    canChangeUnstakeAmount,
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
  const unstakeCta = useMemo<PageCta>(
    () =>
      isLoading
        ? null
        : Maybe.fromRecord({
            integrationData,
            reducedStakedOrLiquidBalance,
            canChangeUnstakeAmount,
            unstakeToken,
          })
            .map(({ integrationData }) => ({
              disabled: unstakeDisabled,
              isLoading: false,
              label: t(
                `position_details.unstake_label.${getExtendedYieldType(integrationData)}`
              ),
              onClick: onUnstakeClick,
            }))
            .extractNullable(),
    [
      canChangeUnstakeAmount,
      integrationData,
      isLoading,
      onUnstakeClick,
      reducedStakedOrLiquidBalance,
      t,
      unstakeDisabled,
      unstakeToken,
    ]
  );

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

  return Maybe.fromRecord({ integrationData, positionBalancesByType })
    .map((v) => (
      <Box
        className={container}
        flex={1}
        display="flex"
        flexDirection="column"
        marginTop="3"
      >
        <Box display="flex" flex={1} flexDirection="column" gap="3">
          <PositionDetailsActionTabs
            canStake={v.integrationData.status.enter}
            canUnstake
          />

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
                    yieldId={v.integrationData.id}
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
                      `position_details.unstake_label.${getExtendedYieldType(v.integrationData)}`
                    )}
                    formattedAmount={unstakeFormattedAmount}
                    balance={reducedStakedOrLiquidBalance}
                    yieldDto={v.integrationData}
                    validators={providersDetails.orDefault([])}
                    showUnstakeInfo={false}
                    ctaPlacement="footer"
                  />

                  <UnstakeInfo
                    unstakeToken={unstakeToken}
                    validators={providersDetails.orDefault([])}
                    yieldDto={v.integrationData}
                  />

                  <PageCtaButton cta={unstakeCta} />
                </>
              )
            )
            .extractNullable()}
        </Box>

        {validatorAddressesHandling.showValidatorsModal && (
          <SelectValidator
            selectedValidators={validatorAddressesHandling.selectedValidators}
            onItemClick={(val) => {
              validatorAddressesHandling.onItemClick(val.address);

              if (validatorAddressesHandling.multiSelect) return;

              onValidatorsSubmit([val.address]);
            }}
            selectedStake={v.integrationData}
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
    ))
    .extractNullable();
};
