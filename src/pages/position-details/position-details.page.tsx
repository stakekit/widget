import {
  Box,
  Button,
  Divider,
  Heading,
  NumberInput,
  Spinner,
  Text,
} from "../../components";
import { TokenIcon } from "../../components/atoms/token-icon";
import { PageContainer } from "../components";
import { usePositionDetails } from "./hooks/use-position-details";
import { Image } from "../../components/atoms/image";
import { ImageFallback } from "../../components/atoms/image-fallback";
import { Trans, useTranslation } from "react-i18next";
import { HelpModal } from "../../components/molecules/help-modal";
import { formatNumber } from "../../utils";
import BigNumber from "bignumber.js";
import { pressAnimation } from "../../components/atoms/button/styles.css";
import { ActionTypes } from "@stakekit/api-hooks";
import { PositionBalances } from "./components/position-balances";
import { Maybe } from "purify-ts";
import { useTrackPage } from "../../hooks/tracking/use-track-page";
import { getRewardTypeFormatted } from "../../utils/get-reward-type";

export const PositionDetails = () => {
  const positionDetails = usePositionDetails();

  const {
    integrationData,
    isLoading,
    stakedOrLiquidBalance,
    stakeType,
    positionBalancesByType,
    unstakeText,
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
    providerDetails,
    liquidTokensToNativeConversion,
  } = positionDetails;

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
        Maybe.fromRecord({ integrationData, stakeType, positionBalancesByType })
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

              {providerDetails
                .map((pd) => (
                  <Box display="flex" flexDirection="column" marginTop="6">
                    <Divider my="1" />

                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Box
                        my="1"
                        display="flex"
                        justifyContent="flex-start"
                        alignItems="center"
                      >
                        <Box marginRight="2">
                          <Image
                            containerProps={{ hw: "8" }}
                            imageProps={{ borderRadius: "full" }}
                            src={pd.logo}
                            fallback={
                              <Box marginRight="1">
                                <ImageFallback
                                  name={pd.name ?? pd.address ?? ""}
                                  tokenLogoHw="8"
                                  textVariant={{
                                    type: "white",
                                    weight: "bold",
                                  }}
                                />
                              </Box>
                            }
                          />
                        </Box>

                        <Text>
                          {val.stakeType}{" "}
                          {t("position_details.via", {
                            providerName: pd.name ?? pd.address ?? "",
                          })}
                        </Text>
                      </Box>

                      <HelpModal
                        modal={{ type: val.integrationData.metadata.type }}
                      />
                    </Box>

                    <Divider my="1" />
                  </Box>
                ))
                .extractNullable()}

              <Box py="3" gap="2" display="flex" flexDirection="column">
                <Box
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Text variant={{ weight: "normal" }}>
                    {getRewardTypeFormatted(val.integrationData.rewardType)}
                  </Text>
                  {providerDetails
                    .map((pd) => (
                      <Text variant={{ type: "muted", weight: "normal" }}>
                        {pd.rewardRateFormatted}
                      </Text>
                    ))
                    .extractNullable()}
                </Box>

                {[...val.positionBalancesByType.values()].map(
                  (yieldBalance) => (
                    <PositionBalances
                      key={yieldBalance.type}
                      integrationData={val.integrationData}
                      yieldBalance={yieldBalance}
                    />
                  )
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
                {pendingActions
                  .map((val) =>
                    val.map((pa) => (
                      <Box
                        key={pa.pendingActionDto.type}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        px="4"
                        py="4"
                        borderRadius="2xl"
                        borderColor="backgroundMuted"
                        borderWidth={1}
                        borderStyle="solid"
                      >
                        <Box flex={2}>
                          <Text variant={{ weight: "normal" }}>
                            <Trans
                              i18nKey="position_details.available_to"
                              values={{
                                amount: formatNumber(
                                  new BigNumber(pa.yieldBalance.amount)
                                ),
                                symbol: pa.yieldBalance.token.symbol,
                                pendingAction: t(
                                  `position_details.pending_action.${
                                    pa.pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
                                  }` as const
                                ),
                              }}
                              components={{
                                bold: (
                                  <Box
                                    as="span"
                                    fontWeight="bold"
                                    display="block"
                                  />
                                ),
                              }}
                            />
                          </Text>
                        </Box>

                        <Box
                          flex={1}
                          maxWidth="24"
                          justifyContent="flex-end"
                          display="flex"
                          alignItems="center"
                        >
                          {pa.isLoading && (
                            <Box marginRight="3" display="flex">
                              <Spinner />
                            </Box>
                          )}
                          <Button
                            variant={{
                              size: "small",
                              color: "smallButtonLight",
                            }}
                            disabled={pa.isLoading}
                            onClick={() =>
                              onPendingActionClick({
                                yieldBalance: pa.yieldBalance,
                                pendingActionDto: pa.pendingActionDto,
                              })
                            }
                          >
                            <Text>
                              {t(
                                `position_details.pending_action_button.${
                                  pa.pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
                                }` as const
                              )}
                            </Text>
                          </Button>
                        </Box>
                      </Box>
                    ))
                  )
                  .extractNullable()}

                {canUnstake
                  .chain(() => stakedOrLiquidBalance.map((b) => ({ b })))
                  .chain((val) => unstakeText.map((ut) => ({ ...val, ut })))
                  .chain((val) =>
                    canChangeAmount.map((cca) => ({ ...val, cca }))
                  )
                  .map(({ b, ut, cca }) => (
                    <Box
                      background="stakeSectionBackground"
                      borderRadius="xl"
                      marginTop="2"
                      py="4"
                      px="4"
                    >
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Box
                          minWidth="0"
                          display="flex"
                          marginRight="2"
                          flex={1}
                        >
                          <NumberInput
                            onChange={onUnstakeAmountChange}
                            value={unstakeAmount}
                            disabled={!cca}
                          />
                        </Box>

                        {onStakeExitIsLoading && (
                          <Box marginRight="3" display="flex">
                            <Spinner />
                          </Box>
                        )}

                        <Button
                          onClick={onUnstakeClick}
                          disabled={unstakeDisabled}
                          variant={{ size: "small", color: "smallButton" }}
                        >
                          <Text>{ut}</Text>
                        </Button>
                      </Box>

                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        marginTop="2"
                        flexWrap="wrap"
                      >
                        <Box flex={1}>
                          <Text
                            variant={{
                              type: "muted",
                              weight: "normal",
                            }}
                          >
                            {unstakeFormattedAmount}
                          </Text>
                        </Box>

                        <Box
                          display="flex"
                          justifyContent="flex-end"
                          alignItems="center"
                        >
                          <Text
                            variant={{
                              weight: "normal",
                            }}
                          >
                            {`${formatNumber(new BigNumber(b.amount ?? 0))} ${
                              b.token.symbol
                            } ${t("position_details.available")}`}
                          </Text>
                          {cca && (
                            <Box
                              as="button"
                              borderRadius="xl"
                              background="background"
                              px="2"
                              py="1"
                              marginLeft="2"
                              onClick={onMaxClick}
                              className={pressAnimation}
                            >
                              <Text
                                variant={{
                                  weight: "semibold",
                                  type: "regular",
                                }}
                              >
                                {t("shared.max")}
                              </Text>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  ))
                  .extractNullable()}
              </Box>
            </Box>
          ))
          .extractNullable()
      )}
    </PageContainer>
  );
};
