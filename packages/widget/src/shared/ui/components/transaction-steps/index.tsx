import clsx from "clsx";
import type { TFunction } from "i18next";
import { type PropsWithChildren, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
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

export type TransactionStepPhaseStatus = "idle" | "active" | "failed" | "done";

type TransactionStepPhase = Readonly<{
  /** Shown under the label unless the phase failed. */
  description?: string;
  failureMessage: string;
  label: string;
  status: TransactionStepPhaseStatus;
}>;

export type TransactionStepItem = {
  readonly done: boolean;
  readonly explorerUrl?: string | null;
  readonly id: string;
  /** Phases in the order they run; a final "completed" row follows them. */
  readonly phases: ReadonlyArray<TransactionStepPhase>;
  /** Human-readable transaction type shown in the step title. */
  readonly type: string;
};

/** Labels the sign, broadcast and confirm phases of one transaction. */
export const getTransactionStepPhases = (
  t: TFunction,
  statuses: Readonly<{
    sign: TransactionStepPhaseStatus;
    broadcast: TransactionStepPhaseStatus;
    confirm: TransactionStepPhaseStatus;
  }>
): ReadonlyArray<TransactionStepPhase> => [
  {
    description: t("steps.approve_desc"),
    failureMessage: t("steps.approve_error"),
    label: t("steps.approve"),
    status: statuses.sign,
  },
  {
    failureMessage: t("shared.something_went_wrong"),
    label: t("steps.submitting"),
    status: statuses.broadcast,
  },
  {
    failureMessage: t("shared.something_went_wrong"),
    label: t("steps.pending"),
    status: statuses.confirm,
  },
];

type Position = "SINGLE" | "FIRST" | "LAST" | "ELSE";

const getPosition = (length: number, index: number): Position => {
  if (length === 1) return "SINGLE";
  if (index === 0) return "FIRST";
  if (index === length - 1) return "LAST";
  return "ELSE";
};

/**
 * Transactions as a vertical timeline; finished ones collapse. Headers omit
 * the "x / N" count unless `numbered`, for lists that grow while running.
 */
export const TransactionSteps = ({
  numbered = true,
  steps,
}: {
  readonly numbered?: boolean;
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
        count={numbered ? { current: index + 1, total: steps.length } : null}
        key={step.id}
        position={getPosition(steps.length, index)}
        step={step}
      />
    ))}
  </Box>
);

type StepProps = {
  readonly count: {
    readonly current: number;
    readonly total: number;
  } | null;
  readonly position: Position;
  readonly step: TransactionStepItem;
};

const TransactionStep = (props: StepProps) => {
  const canCollapse =
    (props.step.done &&
      props.position !== "LAST" &&
      props.position !== "SINGLE") ||
    props.step.phases.every((phase) => phase.status === "idle");

  return (
    <TransactionStepContent
      key={canCollapse ? "collapsible" : "expanded"}
      canCollapse={canCollapse}
      {...props}
    />
  );
};

const getPhaseIcon = (status: TransactionStepPhaseStatus): ReactNode => {
  switch (status) {
    case "active":
      return <Spinner variant={{ color: "inverted" }} />;
    case "failed":
      return <XIcon color="background" />;
    case "done":
      return <CheckSteps hw={18} />;
    case "idle":
      return null;
  }
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

/**
 * A phase is reached once it leaves idle or the phase before it is done; the
 * first row has no connector above it, so its text aligns to the top.
 */
const PhaseRow = ({
  phase,
  previous,
}: {
  readonly phase: TransactionStepPhase;
  readonly previous: TransactionStepPhase | null;
}) => {
  const reached = phase.status !== "idle" || previous?.status === "done";
  const first = previous === null;

  return (
    <Box
      display="flex"
      alignItems={first ? undefined : "center"}
      opacity={reached ? 1 : 0.5}
    >
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        marginRight="3"
        className={clsx({
          [stepsAfter]: true,
          [stepsBefore]: !first,
          [stepsAfterMuted]: phase.status !== "done",
          [halfOpacityAfter]:
            phase.status === "active" || phase.status === "failed",
          [stepsBeforeMuted]: !first && previous.status !== "done",
        })}
      >
        <StepCircle active={reached}>{getPhaseIcon(phase.status)}</StepCircle>
      </Box>

      <Box
        flexDirection="column"
        display="flex"
        alignItems="flex-start"
        gap="1"
        marginTop={first ? undefined : "6"}
      >
        <Text>{phase.label}</Text>
        {phase.status === "failed" ? (
          <Text variant={{ type: "danger" }}>{phase.failureMessage}</Text>
        ) : null}
        {phase.status !== "failed" && phase.description ? (
          <Text variant={{ type: "muted", weight: "normal" }}>
            {phase.description}
          </Text>
        ) : null}
      </Box>
    </Box>
  );
};

const CompletedRow = ({ completed }: { readonly completed: boolean }) => {
  const { t } = useTranslation();

  return (
    <Box display="flex" alignItems="center" opacity={completed ? 1 : 0.5}>
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        marginRight="3"
        paddingBottom="2"
        className={clsx({
          [stepsBefore]: true,
          [stepsBeforeMuted]: !completed,
        })}
      >
        <StepCircle active={completed}>
          {completed && <CheckSteps hw={18} />}
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
  );
};

const TransactionStepContent = ({
  canCollapse,
  count,
  position,
  step,
}: StepProps & { readonly canCollapse: boolean }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(canCollapse);

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
            {/* Unnumbered: the singular form shows no index. */}
            {t("steps.tx_of", {
              count: count?.total ?? 1,
              current: count?.current,
              type: step.type,
            })}
          </Text>

          {canCollapse && <CollapsibleArrow />}
        </CollapsibleTrigger>

        <CollapsibleContent>
          {step.phases.map((phase, index) => (
            <PhaseRow
              key={phase.label}
              phase={phase}
              previous={step.phases[index - 1] ?? null}
            />
          ))}

          <CompletedRow completed={step.phases.at(-1)?.status === "done"} />
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
