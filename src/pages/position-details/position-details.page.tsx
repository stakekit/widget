import { Box, Button, Heading, Spinner, Text } from "../../components";
import { TokenIcon } from "../../components/atoms/token-icon";
import { PageContainer } from "../components";
import { usePositionDetails } from "./hooks/use-position-details";
import { useTranslation } from "react-i18next";
import { PositionBalances } from "./components/position-balances";
import { Maybe } from "purify-ts";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { ProviderDetails } from "./components/provider-details";
import { SelectValidator } from "../../components/molecules/select-validator";
import { AmountBlock } from "./components/amount-block";
import { StaticActionBlock } from "./components/static-action-block";
import { ActionTypes } from "@stakekit/api-hooks";

export const PositionDetails = () => {
  const {
    onPendingActionAmountChange,
    integrationData,
    isLoading,
    reducedStakedOrLiquidBalance,
    positionBalancesByType,
    canUnstake,
    onUnstakeAmountChange,
    unstakeAmount,
    unstakeFormattedAmount,
    canChangeAmount,
    onMaxClick,
    onUnstakeClick,
    onStakeExitIsLoading,
    error,
    unstakeDisabled,
    onPendingActionClick,
    pendingActions,
    providersDetails,
    liquidTokensToNativeConversion,
    validatorAddressesHandling,
    onValidatorsSubmit,
  } = usePositionDetails();

  useTrackPage("positionDetails", {
    yield: integrationData.map((i) => i.metadata.name).extract(),
  });

  const { t } = useTranslation();

  return (
    <PageContainer>
      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center">
          <Spinner />
        </Box>
      ) : (
        Maybe.fromRecord({ integrationData, positionBalancesByType })
          .map((val) => (
            <Box flex={1} display="flex" flexDirection="column">
              <Box display="flex" justifyContent="center" alignItems="center">
                <TokenIcon
                  metadata={val.integrationData.metadata}
                  token={val.integrationData.token}
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
                <Heading variant={{ level: "h4" }}>
                  {val.integrationData.metadata.name}
                </Heading>
                <Text variant={{ type: "muted" }}>
                  {val.integrationData.token.symbol}
                </Text>
              </Box>

              <Box marginTop="4">
                {providersDetails
                  .map((pd) =>
                    pd.map((p, idx) => (
                      <ProviderDetails
                        {...p}
                        key={p.address ?? idx}
                        isFirst={idx === 0}
                        stakeType={t(
                          `position_details.stake_type.${val.integrationData.metadata.type}`
                        )}
                        integrationData={val.integrationData}
                      />
                    ))
                  )
                  .extractNullable()}
              </Box>

              <Box py="3" gap="2" display="flex" flexDirection="column">
                {[...val.positionBalancesByType.values()].flatMap(
                  (yieldBalance) =>
                    yieldBalance.map((yb) => (
                      <PositionBalances
                        key={yb.type}
                        integrationData={val.integrationData}
                        yieldBalance={yb}
                      />
                    ))
                )}
              </Box>

              {error && (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  marginBottom="6"
                >
                  <Text variant={{ type: "danger" }}>
                    {t("shared.something_went_wrong")}
                  </Text>
                </Box>
              )}

              {liquidTokensToNativeConversion
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
                    val.map((pa) =>
                      pa.amount ? (
                        <AmountBlock
                          key={pa.pendingActionDto.type}
                          variant="action"
                          isLoading={pa.isLoading}
                          onAmountChange={(val) =>
                            onPendingActionAmountChange(
                              pa.pendingActionDto.type,
                              val
                            )
                          }
                          value={pa.amount}
                          canChangeAmount
                          onClick={() =>
                            onPendingActionClick({
                              pendingActionDto: pa.pendingActionDto,
                              yieldBalance: pa.yieldBalance,
                            })
                          }
                          label={t(
                            `position_details.pending_action_button.${
                              pa.pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
                            }`
                          )}
                          onMaxClick={null}
                          formattedAmount={pa.formattedAmount}
                          balance={null}
                        />
                      ) : (
                        <StaticActionBlock
                          {...pa}
                          key={pa.pendingActionDto.type}
                          onPendingActionClick={onPendingActionClick}
                        />
                      )
                    )
                  )
                  .extractNullable()}

                {/* Unstake  */}
                {Maybe.fromRecord({
                  canUnstake,
                  reducedStakedOrLiquidBalance,
                  canChangeAmount,
                })
                  .map(({ reducedStakedOrLiquidBalance, canChangeAmount }) => (
                    <AmountBlock
                      variant="unstake"
                      isLoading={onStakeExitIsLoading}
                      onAmountChange={onUnstakeAmountChange}
                      value={unstakeAmount}
                      canChangeAmount={canChangeAmount}
                      disabled={unstakeDisabled}
                      onClick={onUnstakeClick}
                      onMaxClick={onMaxClick}
                      label={t(
                        `position_details.unstake_label.${val.integrationData.metadata.type}`
                      )}
                      formattedAmount={unstakeFormattedAmount}
                      balance={reducedStakedOrLiquidBalance}
                    />
                  ))
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
                  selectedStake={val.integrationData}
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
  );
};
