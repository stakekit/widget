import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Heading,
  Spinner,
  Text,
  XIcon,
} from "../../../components";
import { PageContainer } from "../../components";
import { TxStateEnum, useSteps } from "../hooks/use-steps.hook";
import { CheckSteps } from "../../../components/atoms/icons/check-steps";
import {
  halfOpacityAfter,
  stepsAfter,
  stepsAfterMuted,
  stepsBefore,
  stepsBeforeMuted,
} from "./styles.css";
import cls from "clsx";
import { Maybe } from "purify-ts";
import { ActionDto } from "@stakekit/api-hooks";
import { removeUnderscores } from "../../../utils/text";

export const StepsPage = ({
  session,
  onDone,
}: {
  session: Maybe<ActionDto>;
  onDone?: () => void;
}) => {
  const { retry, txStates, onClick } = useSteps({
    session,
    onDone,
  });

  const { t } = useTranslation();

  return (
    <PageContainer>
      <Box marginBottom="2">
        <Heading variant={{ level: "h4" }}>{t("steps.title")}</Heading>
      </Box>

      <Box flex={1} display="flex">
        <Box
          background="backgroundMuted"
          flexDirection="column"
          display="flex"
          px="4"
          py="4"
          borderRadius="xl"
          flex={1}
        >
          {!txStates.length ? (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              flex={1}
            >
              <Spinner />
            </Box>
          ) : (
            txStates.map((txState, i) => {
              return (
                <Box
                  key={txState.tx.id}
                  marginBottom={i === txStates.length - 1 ? "0" : "8"}
                >
                  {txStates.length > 1 && (
                    <Box marginBottom="4">
                      <Text>
                        {t("steps.tx_of_n", {
                          count: i + 1,
                          total: txStates.length,
                          type: removeUnderscores(txState.tx.type),
                        })}
                      </Text>
                    </Box>
                  )}
                  {txState.tx.status === "WAITING_FOR_SIGNATURE" ? (
                    <>
                      <Box
                        display="flex"
                        opacity={
                          txState.state > TxStateEnum.SIGN_IDLE ? 1 : 0.5
                        }
                      >
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          marginRight="3"
                          className={cls({
                            [stepsAfter]: true,
                            [halfOpacityAfter]:
                              txState.state < TxStateEnum.SIGN_SUCCESS,
                            [stepsAfterMuted]:
                              txState.state > TxStateEnum.SIGN_IDLE &&
                              txState.state < TxStateEnum.SIGN_SUCCESS,
                          })}
                        >
                          <Box
                            background={
                              txState.state > TxStateEnum.SIGN_IDLE
                                ? "text"
                                : "white"
                            }
                            borderColor={
                              txState.state > TxStateEnum.SIGN_IDLE
                                ? "text"
                                : "textMuted"
                            }
                            borderRadius="half"
                            hw="10"
                            borderWidth={3}
                            borderStyle="solid"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {txState.state === TxStateEnum.SIGN_LOADING ? (
                              <Spinner variant={{ color: "inverted" }} />
                            ) : txState.state === TxStateEnum.SIGN_ERROR ? (
                              <XIcon color="background" />
                            ) : txState.state >= TxStateEnum.SIGN_SUCCESS ? (
                              <CheckSteps hw={18} />
                            ) : null}
                          </Box>
                        </Box>
                        <Box
                          flexDirection="column"
                          display="flex"
                          alignItems="flex-start"
                          gap="1"
                        >
                          <Text>{t("steps.approve")}</Text>
                          {txState.state === TxStateEnum.SIGN_ERROR ? (
                            <Text variant={{ type: "danger" }}>
                              {t("shared.something_went_wrong")}
                            </Text>
                          ) : (
                            <Text variant={{ type: "muted", weight: "normal" }}>
                              {t("steps.approve_desc")}
                            </Text>
                          )}
                        </Box>
                      </Box>

                      <Box
                        display="flex"
                        alignItems="center"
                        opacity={
                          txState.state >= TxStateEnum.SIGN_SUCCESS ? 1 : 0.5
                        }
                      >
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          marginRight="3"
                          className={cls({
                            [stepsAfter]: true,
                            [stepsBefore]: true,
                            [stepsAfterMuted]:
                              txState.state < TxStateEnum.BROADCAST_SUCCESS,
                            [halfOpacityAfter]:
                              txState.state === TxStateEnum.BROADCAST_LOADING ||
                              txState.state === TxStateEnum.BROADCAST_ERROR,
                            [stepsBeforeMuted]:
                              txState.state < TxStateEnum.SIGN_SUCCESS,
                          })}
                        >
                          <Box
                            background={
                              txState.state >= TxStateEnum.SIGN_SUCCESS
                                ? "text"
                                : "white"
                            }
                            borderColor={
                              txState.state >= TxStateEnum.SIGN_SUCCESS
                                ? "text"
                                : "textMuted"
                            }
                            borderRadius="half"
                            borderWidth={3}
                            borderStyle="solid"
                            hw="10"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {txState.state === TxStateEnum.BROADCAST_LOADING ? (
                              <Spinner variant={{ color: "inverted" }} />
                            ) : txState.state ===
                              TxStateEnum.BROADCAST_ERROR ? (
                              <XIcon color="background" />
                            ) : txState.state >=
                              TxStateEnum.BROADCAST_SUCCESS ? (
                              <CheckSteps hw={18} />
                            ) : null}
                          </Box>
                        </Box>

                        <Box
                          flexDirection="column"
                          display="flex"
                          alignItems="flex-start"
                          gap="1"
                        >
                          <Text>{t("steps.submitting")}</Text>
                          {txState.state === TxStateEnum.BROADCAST_ERROR && (
                            <Text variant={{ type: "danger" }}>
                              {t("shared.something_went_wrong")}
                            </Text>
                          )}
                        </Box>
                      </Box>

                      <Box
                        display="flex"
                        alignItems="center"
                        opacity={
                          txState.state >= TxStateEnum.BROADCAST_SUCCESS
                            ? 1
                            : 0.5
                        }
                      >
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          marginRight="3"
                          className={cls({
                            [stepsAfter]: true,
                            [stepsBefore]: true,
                            [stepsAfterMuted]:
                              txState.state <
                              TxStateEnum.CHECK_TX_STATUS_SUCCESS,
                            [halfOpacityAfter]:
                              txState.state ===
                                TxStateEnum.CHECK_TX_STATUS_LOADING ||
                              txState.state ===
                                TxStateEnum.CHECK_TX_STATUS_ERROR,
                            [stepsBeforeMuted]:
                              txState.state < TxStateEnum.BROADCAST_SUCCESS,
                          })}
                        >
                          <Box
                            background={
                              txState.state >= TxStateEnum.BROADCAST_SUCCESS
                                ? "text"
                                : "white"
                            }
                            borderColor={
                              txState.state >= TxStateEnum.BROADCAST_SUCCESS
                                ? "text"
                                : "textMuted"
                            }
                            borderRadius="half"
                            borderWidth={3}
                            borderStyle="solid"
                            hw="10"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {txState.state ===
                            TxStateEnum.CHECK_TX_STATUS_LOADING ? (
                              <Spinner variant={{ color: "inverted" }} />
                            ) : txState.state ===
                              TxStateEnum.CHECK_TX_STATUS_ERROR ? (
                              <XIcon color="background" />
                            ) : txState.state >=
                              TxStateEnum.CHECK_TX_STATUS_SUCCESS ? (
                              <CheckSteps hw={18} />
                            ) : null}
                          </Box>
                        </Box>

                        <Box
                          flexDirection="column"
                          display="flex"
                          alignItems="flex-start"
                          gap="1"
                        >
                          <Text>{t("steps.pending")}</Text>
                          {txState.state ===
                            TxStateEnum.CHECK_TX_STATUS_ERROR && (
                            <Text variant={{ type: "danger" }}>
                              {t("shared.something_went_wrong")}
                            </Text>
                          )}
                        </Box>
                      </Box>

                      <Box
                        display="flex"
                        alignItems="center"
                        opacity={
                          txState.state >= TxStateEnum.CHECK_TX_STATUS_SUCCESS
                            ? 1
                            : 0.5
                        }
                      >
                        <Box
                          display="flex"
                          flexDirection="column"
                          alignItems="center"
                          marginRight="3"
                          paddingBottom="2"
                          className={cls({
                            [stepsBefore]: true,
                            [stepsBeforeMuted]:
                              txState.state <
                              TxStateEnum.CHECK_TX_STATUS_SUCCESS,
                          })}
                        >
                          <Box
                            background={
                              txState.state >=
                              TxStateEnum.CHECK_TX_STATUS_SUCCESS
                                ? "text"
                                : "white"
                            }
                            borderColor={
                              txState.state >=
                              TxStateEnum.CHECK_TX_STATUS_SUCCESS
                                ? "text"
                                : "textMuted"
                            }
                            borderWidth={3}
                            borderStyle="solid"
                            borderRadius="half"
                            hw="10"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                          >
                            {txState.state >=
                              TxStateEnum.CHECK_TX_STATUS_SUCCESS && (
                              <CheckSteps hw={18} />
                            )}
                          </Box>
                        </Box>

                        <Box
                          flexDirection="column"
                          display="flex"
                          alignItems="flex-start"
                          gap="1"
                        >
                          <Text>{t("steps.completed")}</Text>
                        </Box>
                      </Box>
                    </>
                  ) : (
                    <Box>
                      <Text>{t("steps.skipped")}</Text>
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      {retry && (
        <Box my="4">
          <Button onClick={retry}>{t("shared.retry")}</Button>
        </Box>
      )}

      <Box display="flex" alignItems="flex-end" marginTop="8">
        <Button onClick={onClick} variant={{ color: "secondary" }}>
          {t("shared.cancel")}
        </Button>
      </Box>
    </PageContainer>
  );
};
