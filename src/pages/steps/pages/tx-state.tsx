import { useTranslation } from "react-i18next";
import { Box, CaretDownIcon, Spinner, Text, XIcon } from "../../../components";
import { TxStateEnum, useSteps } from "../hooks/use-steps.hook";
import { removeUnderscores } from "../../../utils/text";
import clsx from "clsx";
import {
  caretContainer,
  halfOpacityAfter,
  rotate180deg,
  stepsAfter,
  stepsAfterMuted,
  stepsBefore,
  stepsBeforeMuted,
  stepsContainer,
} from "./styles.css";
import { CheckSteps } from "../../../components/atoms/icons/check-steps";
import { useEffect, useRef, useState } from "react";

type Props = {
  txState: ReturnType<typeof useSteps>["txStates"][number];
  position: "FIRST" | "LAST" | "ELSE";
  count: { current: number; total: number } | null;
};

export const TxState = ({ txState, position, count }: Props) => {
  const { t } = useTranslation();

  const canCollapse =
    (txState.meta.done && position !== "LAST") ||
    (txState.tx.status === "WAITING_FOR_SIGNATURE" &&
      txState.state === TxStateEnum.SIGN_IDLE);

  const [isCollapsed, setIsCollapsed] = useState(canCollapse);

  const stepsContainerRef = useRef<HTMLDivElement>();
  const stepsContainerHeight = useRef<number>();

  useEffect(() => {
    setIsCollapsed(canCollapse);
  }, [canCollapse]);

  useEffect(() => {
    stepsContainerHeight.current = stepsContainerRef.current?.scrollHeight;
  }, []);

  return (
    <Box key={txState.tx.id} marginTop={position === "FIRST" ? "0" : "4"}>
      {count && (
        <Box
          width="full"
          marginBottom="4"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          as={canCollapse ? "button" : "div"}
          onClick={() => canCollapse && setIsCollapsed(!isCollapsed)}
        >
          <Text>
            {t("steps.tx_of_n", {
              count: count.current,
              total: count.total,
              type: removeUnderscores(txState.tx.type),
            })}
          </Text>

          {canCollapse && (
            <Box
              display="flex"
              justifyContent="center"
              alignItems="center"
              className={clsx([
                caretContainer,
                { [rotate180deg]: !isCollapsed },
              ])}
            >
              <CaretDownIcon size={20} />
            </Box>
          )}
        </Box>
      )}
      <Box
        ref={stepsContainerRef}
        className={stepsContainer}
        {...(stepsContainerHeight.current && {
          style: { maxHeight: isCollapsed ? 0 : stepsContainerHeight.current },
        })}
      >
        {txState.tx.status === "WAITING_FOR_SIGNATURE" ? (
          <>
            <Box
              display="flex"
              opacity={txState.state > TxStateEnum.SIGN_IDLE ? 1 : 0.5}
            >
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                marginRight="3"
                className={clsx({
                  [stepsAfter]: true,
                  [halfOpacityAfter]: txState.state < TxStateEnum.SIGN_SUCCESS,
                  [stepsAfterMuted]:
                    txState.state > TxStateEnum.SIGN_IDLE &&
                    txState.state < TxStateEnum.SIGN_SUCCESS,
                })}
              >
                <Box
                  background={
                    txState.state > TxStateEnum.SIGN_IDLE ? "text" : "white"
                  }
                  borderColor={
                    txState.state > TxStateEnum.SIGN_IDLE ? "text" : "textMuted"
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
              opacity={txState.state >= TxStateEnum.SIGN_SUCCESS ? 1 : 0.5}
            >
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                marginRight="3"
                className={clsx({
                  [stepsAfter]: true,
                  [stepsBefore]: true,
                  [stepsAfterMuted]:
                    txState.state < TxStateEnum.BROADCAST_SUCCESS,
                  [halfOpacityAfter]:
                    txState.state === TxStateEnum.BROADCAST_LOADING ||
                    txState.state === TxStateEnum.BROADCAST_ERROR,
                  [stepsBeforeMuted]: txState.state < TxStateEnum.SIGN_SUCCESS,
                })}
              >
                <Box
                  background={
                    txState.state >= TxStateEnum.SIGN_SUCCESS ? "text" : "white"
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
                  ) : txState.state === TxStateEnum.BROADCAST_ERROR ? (
                    <XIcon color="background" />
                  ) : txState.state >= TxStateEnum.BROADCAST_SUCCESS ? (
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
              opacity={txState.state >= TxStateEnum.BROADCAST_SUCCESS ? 1 : 0.5}
            >
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                marginRight="3"
                className={clsx({
                  [stepsAfter]: true,
                  [stepsBefore]: true,
                  [stepsAfterMuted]:
                    txState.state < TxStateEnum.CHECK_TX_STATUS_SUCCESS,
                  [halfOpacityAfter]:
                    txState.state === TxStateEnum.CHECK_TX_STATUS_LOADING ||
                    txState.state === TxStateEnum.CHECK_TX_STATUS_ERROR,
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
                  {txState.state === TxStateEnum.CHECK_TX_STATUS_LOADING ? (
                    <Spinner variant={{ color: "inverted" }} />
                  ) : txState.state === TxStateEnum.CHECK_TX_STATUS_ERROR ? (
                    <XIcon color="background" />
                  ) : txState.state >= TxStateEnum.CHECK_TX_STATUS_SUCCESS ? (
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
                {txState.state === TxStateEnum.CHECK_TX_STATUS_ERROR && (
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
                txState.state >= TxStateEnum.CHECK_TX_STATUS_SUCCESS ? 1 : 0.5
              }
            >
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                marginRight="3"
                paddingBottom="2"
                className={clsx({
                  [stepsBefore]: true,
                  [stepsBeforeMuted]:
                    txState.state < TxStateEnum.CHECK_TX_STATUS_SUCCESS,
                })}
              >
                <Box
                  background={
                    txState.state >= TxStateEnum.CHECK_TX_STATUS_SUCCESS
                      ? "text"
                      : "white"
                  }
                  borderColor={
                    txState.state >= TxStateEnum.CHECK_TX_STATUS_SUCCESS
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
                  {txState.state >= TxStateEnum.CHECK_TX_STATUS_SUCCESS && (
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
    </Box>
  );
};
