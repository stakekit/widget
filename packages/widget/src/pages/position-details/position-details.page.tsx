import { UnstakeOrPendingActionProvider } from "@sk-widget/pages/position-details/state";
import type { ActionTypes } from "@stakekit/api-hooks";
import { Just, Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { Box, Button, Heading, Spinner, Text } from "../../components";
import { TokenIcon } from "../../components/atoms/token-icon";
import { SelectValidator } from "../../components/molecules/select-validator";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { AnimationPage } from "../../navigation/containers/animation-page";
import { PageContainer } from "../components";
import { AmountBlock } from "./components/amount-block";
import { PositionBalances } from "./components/position-balances";
import { ProviderDetails } from "./components/provider-details";
import { StaticActionBlock } from "./components/static-action-block";
import { usePositionDetails } from "./hooks/use-position-details";
import { container } from "./styles.css";

const PositionDetails = () => {
  const {
    onPendingActionAmountChange,
    integrationData,
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
    liquidTokensToNativeConversion,
    validatorAddressesHandling,
    onValidatorsSubmit,
    unstakeToken,
    canUnstake,
    unstakeAmountError,
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
            .map((val) => (
              <Box
                className={container}
                flex={1}
                display="flex"
                flexDirection="column"
              >
                {unstakeToken
                  .altLazy(() => Just(val.integrationData.token))
                  .map((t) => (
                    <>
                      <Box
                        display="flex"
                        justifyContent="center"
                        alignItems="center"
                      >
                        <TokenIcon
                          metadata={val.integrationData.metadata}
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
                        <Heading variant={{ level: "h4" }}>
                          {val.integrationData.metadata.name}
                        </Heading>
                        <Text variant={{ type: "muted" }}>{t.symbol}</Text>
                      </Box>
                    </>
                  ))
                  .extractNullable()}

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
                      yieldBalance.map((yb, i) => (
                        <PositionBalances
                          key={`${yb.type}-${i}`}
                          integrationData={val.integrationData}
                          yieldBalance={yb}
                        />
                      ))
                  )}
                </Box>

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
                          />
                        )
                      )
                    )
                    .extractNullable()}
                  {/* Unstake */}
                  {Maybe.fromRecord({
                    reducedStakedOrLiquidBalance,
                    canChangeUnstakeAmount,
                  })
                    .map(
                      ({
                        reducedStakedOrLiquidBalance,
                        canChangeUnstakeAmount,
                      }) => (
                        <AmountBlock
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
                            `position_details.unstake_label.${val.integrationData.metadata.type}`
                          )}
                          formattedAmount={unstakeFormattedAmount}
                          balance={reducedStakedOrLiquidBalance}
                          yieldDto={val.integrationData}
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
                    selectedStake={val.integrationData}
                    validators={val.integrationData.validators}
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
