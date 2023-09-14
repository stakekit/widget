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
import { apyToPercentage, formatTokenBalance } from "../../utils";
import BigNumber from "bignumber.js";
import { pressAnimation } from "../../components/atoms/button/styles.css";
import { ActionTypes } from "@stakekit/api-hooks";
import { PositionBalances } from "./components/position-balances";

export const PositionDetails = () => {
  const positionDetails = usePositionDetails();

  const {
    isLoading,
    position,
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
    onPendingActionIsLoading,
    pendingActions,
    validatorDetails,
  } = positionDetails;

  const { t } = useTranslation();

  return (
    <PageContainer>
      {isLoading && (
        <Box display="flex" justifyContent="center" alignItems="center">
          <Spinner />
        </Box>
      )}

      {!isLoading &&
        position
          .chain((p) => stakeType.map((st) => ({ p, st })))
          .chain((val) =>
            positionBalancesByType.map((pbbt) => ({ ...val, pbbt }))
          )
          .map(({ p, st, pbbt }) => (
            <Box flex={1} display="flex" flexDirection="column">
              <Box display="flex" justifyContent="center" alignItems="center">
                <TokenIcon
                  metadata={p.integrationData.metadata}
                  token={p.integrationData.token}
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
                  {p.integrationData.metadata.name}
                </Heading>
                <Text variant={{ type: "muted" }}>
                  {p.integrationData.token.symbol}
                </Text>
              </Box>

              {validatorDetails
                .map((vd) => (
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
                        <Image
                          hw="8"
                          marginRight="1"
                          src={vd.logoURI}
                          fallback={
                            <Box marginRight="1">
                              <ImageFallback
                                name={vd.name ?? vd.address ?? ""}
                                tokenLogoHw="8"
                                textVariant={{
                                  size: "small",
                                  type: "white",
                                  weight: "bold",
                                }}
                              />
                            </Box>
                          }
                        />
                        <Text variant={{ size: "small" }}>
                          {st}{" "}
                          {t("position_details.via", {
                            providerName: vd.name ?? vd.address ?? "",
                          })}
                        </Text>
                      </Box>

                      <HelpModal
                        modal={{ type: p.integrationData.metadata.type }}
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
                  <Text variant={{ weight: "normal" }}>APR</Text>
                  <Text variant={{ type: "muted", weight: "normal" }}>
                    {apyToPercentage(p.integrationData.apy)}%
                  </Text>
                </Box>

                {[...pbbt.values()].map((val) => (
                  <PositionBalances key={val.type} val={val} />
                ))}
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

              <Box
                display="flex"
                flex={1}
                justifyContent="flex-end"
                flexDirection="column"
                marginTop="10"
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
                                amount: formatTokenBalance(
                                  new BigNumber(pa.opportunityBalance.amount),
                                  6
                                ),
                                symbol: pa.opportunityBalance.token.symbol,
                                pendingAction: t(
                                  `position_details.pending_action.${
                                    pa.pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
                                  }`
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
                          {onPendingActionIsLoading && (
                            <Box marginRight="3" display="flex">
                              <Spinner />
                            </Box>
                          )}
                          <Button
                            onClick={() =>
                              onPendingActionClick({
                                opportunityBalance: pa.opportunityBalance,
                                pendingActionDto: pa.pendingActionDto,
                              })
                            }
                            variant={{
                              size: "small",
                              color: onPendingActionIsLoading
                                ? "disabled"
                                : "primary",
                            }}
                            disabled={onPendingActionIsLoading}
                          >
                            {t(
                              `position_details.pending_action_button.${
                                pa.pendingActionDto.type.toLowerCase() as Lowercase<ActionTypes>
                              }`
                            )}
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

                        <Box
                          flex={1}
                          maxWidth="24"
                          display="flex"
                          justifyContent="center"
                          alignItems="center"
                        >
                          <Button
                            onClick={onUnstakeClick}
                            disabled={unstakeDisabled}
                            variant={{
                              size: "small",
                              color: unstakeDisabled ? "disabled" : "primary",
                            }}
                          >
                            {ut}
                          </Button>
                        </Box>
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
                              size: "small",
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
                              size: "small",
                              weight: "normal",
                            }}
                          >
                            {`${formatTokenBalance(
                              new BigNumber(b.amount ?? 0),
                              6
                            )} ${b.token.symbol} ${t(
                              "position_details.available"
                            )}`}
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
                                  size: "small",
                                  weight: "semibold",
                                  type: "white",
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
          .extractNullable()}
    </PageContainer>
  );
};
