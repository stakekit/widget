import type { ActionTypes } from "@stakekit/api-hooks";
import { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box } from "../../../components/atoms/box";
import { Button } from "../../../components/atoms/button";
import { Spinner } from "../../../components/atoms/spinner";
import { SelectValidator } from "../../../components/molecules/select-validator";
import { AmountBlock } from "../../../pages/position-details/components/amount-block";
import { StaticActionBlock } from "../../../pages/position-details/components/static-action-block";
import { usePositionDetails } from "../../../pages/position-details/hooks/use-position-details";
import { container } from "./styles.css";

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
  } = usePositionDetails();

  const { t } = useTranslation();

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
      <Box className={container} flex={1} display="flex" flexDirection="column">
        <Box display="flex" flex={1} flexDirection="column" gap="4">
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
                        val.pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
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
                    `position_details.unstake_label.${v.integrationData.metadata.type}`
                  )}
                  formattedAmount={unstakeFormattedAmount}
                  balance={reducedStakedOrLiquidBalance}
                  yieldDto={v.integrationData}
                  validators={providersDetails.orDefault([])}
                />
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
            validators={v.integrationData.validators}
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
