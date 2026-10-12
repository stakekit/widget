import clsx from "clsx";
import { type PropsWithChildren, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { TransactionStepState } from "../../../lib/transaction-step-state";
import { Box } from "../../primitives/box";
import { CheckSteps } from "../../primitives/icons/check-steps";
import { XIcon } from "../../primitives/icons/x-icon";
import { Spinner } from "../../primitives/spinner";
import { Text } from "../../primitives/typography/text";
import {
  CollapsibleArrow,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "../collapsible";
import {
  explorerLink,
  halfOpacityAfter,
  stepsAfter,
  stepsAfterMuted,
  stepsBefore,
  stepsBeforeMuted,
} from "./styles.css";

export type TransactionStepItem = {
  readonly done: boolean;
  readonly explorerUrl?: string | null;
  readonly id: string;
  readonly state: TransactionStepState;
  /** Human-readable transaction type shown in the step title. */
  readonly type: string;
};

type Position = "SINGLE" | "FIRST" | "LAST" | "ELSE";

const getPosition = (length: number, index: number): Position => {
  if (length === 1) return "SINGLE";
  if (index === 0) return "FIRST";
  if (index === length - 1) return "LAST";
  return "ELSE";
};

/** Transactions as a vertical timeline; finished ones collapse. */
export const TransactionSteps = ({
  steps,
}: {
  readonly steps: ReadonlyArray<TransactionStepItem>;
}) => (
  <Box
    background="backgroundMuted"
    borderRadius="xl"
    display="flex"
    flex={1}
    flexDirection="column"
    px="4"
    py="4"
  >
    {steps.map((step, index) => (
      <TransactionStep
        count={{ current: index + 1, total: steps.length }}
        key={step.id}
        position={getPosition(steps.length, index)}
        step={step}
      />
    ))}
  </Box>
);

type StepProps = {
  readonly count: { readonly current: number; readonly total: number };
  readonly position: Position;
  readonly step: TransactionStepItem;
};

const TransactionStep = (props: StepProps) => {
  const canCollapse =
    (props.step.done &&
      props.position !== "LAST" &&
      props.position !== "SINGLE") ||
    props.step.state === TransactionStepState.SIGN_IDLE;

  return (
    <TransactionStepContent
      key={canCollapse ? "collapsible" : "expanded"}
      canCollapse={canCollapse}
      {...props}
    />
  );
};

const getStepIcon = ({
  error,
  loading,
  state,
  success,
}: {
  readonly error: TransactionStepState;
  readonly loading: TransactionStepState;
  readonly state: TransactionStepState;
  readonly success: TransactionStepState;
}): ReactNode => {
  if (state === loading) return <Spinner variant={{ color: "inverted" }} />;
  if (state === error) return <XIcon color="background" />;
  if (state >= success) return <CheckSteps hw={18} />;
  return null;
};

const StepCircle = ({
  active,
  children,
}: PropsWithChildren<{ readonly active: boolean }>) => (
  <Box
    alignItems="center"
    background={active ? "text" : "white"}
    borderColor={active ? "text" : "textMuted"}
    borderRadius="half"
    borderStyle="solid"
    borderWidth={3}
    data-rk="tx-state-step-circle"
    data-state={active ? "success" : "pending"}
    display="flex"
    hw="10"
    justifyContent="center"
  >
    {children}
  </Box>
);

const TransactionStepContent = ({
  canCollapse,
  count,
  position,
  step,
}: StepProps & { readonly canCollapse: boolean }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(canCollapse);
  const { state } = step;

  return (
    <Box
      display="flex"
      flexDirection="column"
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
              type: step.type,
            })}
          </Text>

          {canCollapse && <CollapsibleArrow />}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Box
            display="flex"
            opacity={state > TransactionStepState.SIGN_IDLE ? 1 : 0.5}
          >
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              marginRight="3"
              className={clsx({
                [stepsAfter]: true,
                [halfOpacityAfter]: state < TransactionStepState.SIGN_SUCCESS,
                [stepsAfterMuted]:
                  state > TransactionStepState.SIGN_IDLE &&
                  state < TransactionStepState.SIGN_SUCCESS,
              })}
            >
              <StepCircle active={state > TransactionStepState.SIGN_IDLE}>
                {getStepIcon({
                  error: TransactionStepState.SIGN_ERROR,
                  loading: TransactionStepState.SIGN_LOADING,
                  state,
                  success: TransactionStepState.SIGN_SUCCESS,
                })}
              </StepCircle>
            </Box>

            <Box
              flexDirection="column"
              display="flex"
              alignItems="flex-start"
              gap="1"
            >
              <Text>{t("steps.approve")}</Text>
              {state === TransactionStepState.SIGN_ERROR ? (
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
            opacity={state >= TransactionStepState.SIGN_SUCCESS ? 1 : 0.5}
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
                  state < TransactionStepState.BROADCAST_SUCCESS,
                [halfOpacityAfter]:
                  state === TransactionStepState.BROADCAST_LOADING ||
                  state === TransactionStepState.BROADCAST_ERROR,
                [stepsBeforeMuted]: state < TransactionStepState.SIGN_SUCCESS,
              })}
            >
              <StepCircle active={state >= TransactionStepState.SIGN_SUCCESS}>
                {getStepIcon({
                  error: TransactionStepState.BROADCAST_ERROR,
                  loading: TransactionStepState.BROADCAST_LOADING,
                  state,
                  success: TransactionStepState.BROADCAST_SUCCESS,
                })}
              </StepCircle>
            </Box>

            <FailableStepLabel
              label={t("steps.submitting")}
              failed={state === TransactionStepState.BROADCAST_ERROR}
            />
          </Box>

          <Box
            display="flex"
            alignItems="center"
            opacity={state >= TransactionStepState.BROADCAST_SUCCESS ? 1 : 0.5}
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
                  state < TransactionStepState.CHECK_TX_STATUS_SUCCESS,
                [halfOpacityAfter]:
                  state === TransactionStepState.CHECK_TX_STATUS_LOADING ||
                  state === TransactionStepState.CHECK_TX_STATUS_ERROR,
                [stepsBeforeMuted]:
                  state < TransactionStepState.BROADCAST_SUCCESS,
              })}
            >
              <StepCircle
                active={state >= TransactionStepState.BROADCAST_SUCCESS}
              >
                {getStepIcon({
                  error: TransactionStepState.CHECK_TX_STATUS_ERROR,
                  loading: TransactionStepState.CHECK_TX_STATUS_LOADING,
                  state,
                  success: TransactionStepState.CHECK_TX_STATUS_SUCCESS,
                })}
              </StepCircle>
            </Box>

            <FailableStepLabel
              label={t("steps.pending")}
              failed={state === TransactionStepState.CHECK_TX_STATUS_ERROR}
            />
          </Box>

          <Box
            display="flex"
            alignItems="center"
            opacity={
              state >= TransactionStepState.CHECK_TX_STATUS_SUCCESS ? 1 : 0.5
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
                  state < TransactionStepState.CHECK_TX_STATUS_SUCCESS,
              })}
            >
              <StepCircle
                active={state >= TransactionStepState.CHECK_TX_STATUS_SUCCESS}
              >
                {state >= TransactionStepState.CHECK_TX_STATUS_SUCCESS && (
                  <CheckSteps hw={18} />
                )}
              </StepCircle>
            </Box>

            <Box
              flexDirection="column"
              display="flex"
              alignItems="flex-start"
              gap="1"
              marginTop="4"
            >
              <Text>{t("steps.completed")}</Text>
            </Box>
          </Box>
        </CollapsibleContent>
      </CollapsibleRoot>

      {step.explorerUrl ? (
        <a
          className={explorerLink}
          data-rk="tx-state-explorer-link"
          href={step.explorerUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Text variant={{ type: "muted" }}>{t("steps.view_transaction")}</Text>
        </a>
      ) : null}
    </Box>
  );
};

const FailableStepLabel = ({
  label,
  failed,
}: {
  readonly label: string;
  readonly failed: boolean;
}) => {
  const { t } = useTranslation();

  return (
    <Box
      flexDirection="column"
      display="flex"
      alignItems="flex-start"
      gap="1"
      marginTop="6"
    >
      <Text>{label}</Text>
      {failed && (
        <Text variant={{ type: "danger" }}>
          {t("shared.something_went_wrong")}
        </Text>
      )}
    </Box>
  );
};
