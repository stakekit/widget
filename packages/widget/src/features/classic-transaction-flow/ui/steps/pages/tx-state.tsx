import clsx from "clsx";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import type { YieldAction } from "../../../../../domain/schema/action-models";
import { isEthenaUsdeStaking } from "../../../../../domain/types/yields";
import { Box } from "../../../../../shared/ui/primitives/box";
import { CheckSteps } from "../../../../../shared/ui/primitives/icons/check-steps";
import { XIcon } from "../../../../../shared/ui/primitives/icons/x-icon";
import { Spinner } from "../../../../../shared/ui/primitives/spinner";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../../../../widget-shell/ui/collapsible";
import { ClassicTransactionStepState } from "../../../state/classic-transaction-workflow";
import type { useSteps } from "../hooks/use-steps.hook";
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
  yieldId: YieldAction["yieldId"];
};

const getStepIcon = ({
  error,
  loading,
  state,
  success,
}: {
  readonly error: ClassicTransactionStepState;
  readonly loading: ClassicTransactionStepState;
  readonly state: ClassicTransactionStepState;
  readonly success: ClassicTransactionStepState;
}): ReactNode => {
  if (state === loading) return <Spinner variant={{ color: "inverted" }} />;
  if (state === error) return <XIcon color="background" />;
  if (state >= success) return <CheckSteps hw={18} />;
  return null;
};

export const TxState = ({ txState, position, count, yieldId }: Props) => {
  const canCollapse =
    (txState.meta.done && position !== "LAST" && position !== "SINGLE") ||
    txState.state === ClassicTransactionStepState.SIGN_IDLE;

  return (
    <TxStateContent
      key={canCollapse ? "collapsible" : "expanded"}
      canCollapse={canCollapse}
      count={count}
      position={position}
      txState={txState}
      yieldId={yieldId}
    />
  );
};

const TxStateContent = ({
  canCollapse,
  count,
  position,
  txState,
  yieldId,
}: Props & { readonly canCollapse: boolean }) => {
  const { t } = useTranslation();

  const [isCollapsed, setIsCollapsed] = useState(canCollapse);

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
              type: t(
                `steps.tx_type.${txState.tx.type}` as never,
                {
                  context: isEthenaUsdeStaking(yieldId)
                    ? "ETHENA_USDE"
                    : undefined,
                } as never
              ),
            })}
          </Text>

          {canCollapse && !!count && <CollapsibleArrow />}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Box
            display="flex"
            opacity={
              txState.state > ClassicTransactionStepState.SIGN_IDLE ? 1 : 0.5
            }
          >
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              marginRight="3"
              className={clsx({
                [stepsAfter]: true,
                [halfOpacityAfter]:
                  txState.state < ClassicTransactionStepState.SIGN_SUCCESS,
                [stepsAfterMuted]:
                  txState.state > ClassicTransactionStepState.SIGN_IDLE &&
                  txState.state < ClassicTransactionStepState.SIGN_SUCCESS,
              })}
            >
              <Box
                background={
                  txState.state > ClassicTransactionStepState.SIGN_IDLE
                    ? "text"
                    : "white"
                }
                borderColor={
                  txState.state > ClassicTransactionStepState.SIGN_IDLE
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
                data-rk="tx-state-step-circle"
                data-state={
                  txState.state > ClassicTransactionStepState.SIGN_IDLE
                    ? "success"
                    : "pending"
                }
              >
                {getStepIcon({
                  error: ClassicTransactionStepState.SIGN_ERROR,
                  loading: ClassicTransactionStepState.SIGN_LOADING,
                  state: txState.state,
                  success: ClassicTransactionStepState.SIGN_SUCCESS,
                })}
              </Box>
            </Box>

            <Box
              flexDirection="column"
              display="flex"
              alignItems="flex-start"
              gap="1"
            >
              <Text>{t("steps.approve")}</Text>
              {txState.state === ClassicTransactionStepState.SIGN_ERROR ? (
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
            opacity={
              txState.state >= ClassicTransactionStepState.SIGN_SUCCESS
                ? 1
                : 0.5
            }
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
                  txState.state < ClassicTransactionStepState.BROADCAST_SUCCESS,
                [halfOpacityAfter]:
                  txState.state ===
                    ClassicTransactionStepState.BROADCAST_LOADING ||
                  txState.state === ClassicTransactionStepState.BROADCAST_ERROR,
                [stepsBeforeMuted]:
                  txState.state < ClassicTransactionStepState.SIGN_SUCCESS,
              })}
            >
              <Box
                background={
                  txState.state >= ClassicTransactionStepState.SIGN_SUCCESS
                    ? "text"
                    : "white"
                }
                borderColor={
                  txState.state >= ClassicTransactionStepState.SIGN_SUCCESS
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
                  txState.state >= ClassicTransactionStepState.SIGN_SUCCESS
                    ? "success"
                    : "pending"
                }
              >
                {getStepIcon({
                  error: ClassicTransactionStepState.BROADCAST_ERROR,
                  loading: ClassicTransactionStepState.BROADCAST_LOADING,
                  state: txState.state,
                  success: ClassicTransactionStepState.BROADCAST_SUCCESS,
                })}
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
              {txState.state ===
                ClassicTransactionStepState.BROADCAST_ERROR && (
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
              txState.state >= ClassicTransactionStepState.BROADCAST_SUCCESS
                ? 1
                : 0.5
            }
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
                  txState.state <
                  ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS,
                [halfOpacityAfter]:
                  txState.state ===
                    ClassicTransactionStepState.CHECK_TX_STATUS_LOADING ||
                  txState.state ===
                    ClassicTransactionStepState.CHECK_TX_STATUS_ERROR,
                [stepsBeforeMuted]:
                  txState.state < ClassicTransactionStepState.BROADCAST_SUCCESS,
              })}
            >
              <Box
                background={
                  txState.state >= ClassicTransactionStepState.BROADCAST_SUCCESS
                    ? "text"
                    : "white"
                }
                borderColor={
                  txState.state >= ClassicTransactionStepState.BROADCAST_SUCCESS
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
                  txState.state >= ClassicTransactionStepState.BROADCAST_SUCCESS
                    ? "success"
                    : "pending"
                }
              >
                {getStepIcon({
                  error: ClassicTransactionStepState.CHECK_TX_STATUS_ERROR,
                  loading: ClassicTransactionStepState.CHECK_TX_STATUS_LOADING,
                  state: txState.state,
                  success: ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS,
                })}
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
              {txState.state ===
                ClassicTransactionStepState.CHECK_TX_STATUS_ERROR && (
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
              txState.state >=
              ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS
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
              className={clsx({
                [stepsBefore]: true,
                [stepsBeforeMuted]:
                  txState.state <
                  ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS,
              })}
            >
              <Box
                background={
                  txState.state >=
                  ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS
                    ? "text"
                    : "white"
                }
                borderColor={
                  txState.state >=
                  ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS
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
                  txState.state >=
                  ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS
                    ? "success"
                    : "pending"
                }
              >
                {txState.state >=
                  ClassicTransactionStepState.CHECK_TX_STATUS_SUCCESS && (
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
