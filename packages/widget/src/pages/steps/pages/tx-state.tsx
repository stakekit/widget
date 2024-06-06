import clsx from "clsx";
import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Spinner, Text, XIcon } from "../../../components";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../components/atoms/collapsible";
import { CheckSteps } from "../../../components/atoms/icons/check-steps";
import { removeUnderscores } from "../../../utils/text";
import type { useSteps } from "../hooks/use-steps.hook";
import { TxStateEnum } from "../hooks/use-steps.hook";
import {
  halfOpacityAfter,
  stepsAfter,
  stepsAfterMuted,
  stepsBefore,
  stepsBeforeMuted,
} from "./styles.css";

type Props = {
  txState: ReturnType<typeof useSteps>["txStates"][number];
  position: "SINGLE" | "FIRST" | "LAST" | "ELSE";
  count: { current: number; total: number };
};

export const TxState = ({ txState, position, count }: Props) => {
  const { t } = useTranslation();

  const canCollapse =
    (txState.meta.done && position !== "LAST" && position !== "SINGLE") ||
    txState.state === TxStateEnum.SIGN_IDLE;

  const [isCollapsed, setIsCollapsed] = useState(canCollapse);

  useLayoutEffect(() => {
    setIsCollapsed(canCollapse);
  }, [canCollapse]);

  return (
    <Box
      key={txState.tx.id}
      marginTop={position === "FIRST" || position === "SINGLE" ? "0" : "4"}
    >
      <CollapsibleRoot
        onClick={() => canCollapse && setIsCollapsed((prev) => !prev)}
        collapsed={isCollapsed}
      >
        <CollapsibleTrigger
          width="full"
          marginBottom="4"
          as={canCollapse ? "button" : "div"}
        >
          <Text>
            {t("steps.tx_of", {
              count: count.total,
              current: count.current,
              type: removeUnderscores(txState.tx.type),
            })}
          </Text>

          {canCollapse && !!count && <CollapsibleArrow />}
        </CollapsibleTrigger>

        <CollapsibleContent>
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
                data-rk="tx-state-step-circle"
                data-state={
                  txState.state > TxStateEnum.SIGN_IDLE ? "success" : "pending"
                }
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
                  {t("steps.approve_error")}
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
                data-rk="tx-state-step-circle"
                data-state={
                  txState.state >= TxStateEnum.SIGN_SUCCESS
                    ? "success"
                    : "pending"
                }
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
              // TODO: CHANGE THIS!
              marginTop="6"
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
                data-rk="tx-state-step-circle"
                data-state={
                  txState.state >= TxStateEnum.BROADCAST_SUCCESS
                    ? "success"
                    : "pending"
                }
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
              // TODO: CHANGE THIS!
              marginTop="6"
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
                data-rk="tx-state-step-circle"
                data-state={
                  txState.state >= TxStateEnum.CHECK_TX_STATUS_SUCCESS
                    ? "success"
                    : "pending"
                }
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
              // TODO: CHANGE THIS!
              marginTop="4"
            >
              <Text>{t("steps.completed")}</Text>
            </Box>
          </Box>
        </CollapsibleContent>
      </CollapsibleRoot>
    </Box>
  );
};
