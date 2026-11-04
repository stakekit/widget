import * as stylex from "@stylexjs/stylex";
import { Icon } from "../primitives/icon";
import { Text } from "../primitives/text";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { iconSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { Spinner } from "./spinner";

/** Where a step stands. */
type StepStatus = "idle" | "active" | "failed" | "done";

/** One step of a `Steps` timeline. */
type Step = {
  /** Unique within the timeline. */
  readonly id: string;
  readonly label: string;
  /** Shown under the label, such as what to do or what went wrong. */
  readonly description?: string;
  readonly status: StepStatus;
};

type StepsProps = {
  readonly steps: ReadonlyArray<Step>;
  /** Names the list, such as "Transaction progress". */
  readonly label: string;
  /** What each status is called, read after a step's label. */
  readonly statusLabels: Readonly<Record<StepStatus, string>>;
};

/**
 * Steps as a vertical timeline, such as a transaction's sign, submit and
 * confirm. Each step's marker shows its status, which assistive technology
 * reads after the label; the active step is the current one.
 */
export const Steps = ({ steps, label, statusLabels }: StepsProps) => (
  <ol aria-label={label} {...stylex.props(styles.list)}>
    {steps.map((step, index) => (
      <li
        key={step.id}
        aria-current={step.status === "active" ? "step" : undefined}
        {...stylex.props(styles.step)}
      >
        {index < steps.length - 1 && (
          <span aria-hidden="true" {...stylex.props(styles.connector)} />
        )}
        <span {...stylex.props(styles.marker, markerStyles[step.status])}>
          <StepMarker status={step.status} />
        </span>
        <span {...stylex.props(styles.text)}>
          <Text
            tone={step.status === "idle" ? "muted" : "default"}
            weight="medium"
          >
            {step.label}
            <VisuallyHidden>{`, ${statusLabels[step.status]}`}</VisuallyHidden>
          </Text>
          {step.description !== undefined && (
            <Text
              variant="caption"
              tone={step.status === "failed" ? "danger" : "muted"}
            >
              {step.description}
            </Text>
          )}
        </span>
      </li>
    ))}
  </ol>
);

const StepMarker = ({ status }: { readonly status: StepStatus }) => {
  switch (status) {
    case "done":
      return <Icon name="StepCheckIcon" size="sm" />;
    case "active":
      return <Spinner size="sm" />;
    case "failed":
      return <Icon name="XIcon" size="sm" />;
    case "idle":
      return null;
  }
};

const styles = stylex.create({
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
  },
  step: {
    gap: space[12],
    display: "flex",
    position: "relative",
    paddingBottom: { default: space[16], ":last-child": 0 },
  },
  // Runs from each marker down to the next one.
  connector: {
    backgroundColor: color.border,
    position: "absolute",
    bottom: 0,
    left: `calc(${iconSize.lg} / 2 - ${borderWidth.thick} / 2)`,
    top: iconSize.lg,
    width: borderWidth.thick,
  },
  marker: {
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    alignItems: "center",
    boxSizing: "border-box",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    height: iconSize.lg,
    width: iconSize.lg,
  },
  text: {
    gap: space[2],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    paddingTop: space[2],
  },
});

const markerStyles = stylex.create({
  idle: { borderColor: color.textMuted, color: color.textMuted },
  active: { borderColor: "transparent", color: color.accentText },
  failed: {
    borderColor: color.dangerSoft,
    backgroundColor: color.dangerSoft,
    color: color.danger,
  },
  done: {
    borderColor: color.accent,
    backgroundColor: color.accent,
    color: color.onAccent,
  },
});
