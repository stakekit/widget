import * as stylex from "@stylexjs/stylex";
import type { HostHook } from "../host-hook";
import { Icon } from "../primitives/icon";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { stepMarkerSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { Button } from "./button";
import { ExternalLink } from "./external-link";
import { Spinner } from "./spinner";

/** Where a step stands. */
type StepStatus = "idle" | "active" | "failed" | "done";

/** One step of a `Steps` timeline. */
type Step = {
  /** Unique within the timeline. */
  readonly id: string;
  readonly label: string;
  readonly status: StepStatus;
  /**
   * What the step is doing, on the line under its label, such as "Waiting
   * for signature". Unset, that line shows its status's label.
   */
  readonly state?: string;
  /** Shown under the state, such as how long it takes or what went wrong. */
  readonly description?: string;
  /** A link under the step, such as its transaction on a block explorer. */
  readonly link?: StepLink;
  /** A button under the step, such as retrying the step that failed. */
  readonly action?: StepAction;
};

type StepLink = {
  readonly href: string;
  readonly label: string;
  /** Names the new-tab icon, such as "opens in a new tab". */
  readonly newTabLabel: string;
  /**
   * Read before the label only, for a label that does not say where it
   * leads, such as "View transaction" before a shortened hash.
   */
  readonly context?: string;
};

type StepAction = {
  readonly label: string;
  readonly onClick: () => void;
  /** Shows the button busy, such as while the retry runs. */
  readonly loading?: boolean;
  readonly hostHook?: HostHook;
};

type StepsProps = {
  readonly steps: ReadonlyArray<Step>;
  /** Names the list, such as "Transaction progress". */
  readonly label: string;
  /** What each status is called: a step's state line unless it has its own. */
  readonly statusLabels: Readonly<Record<StepStatus, string>>;
};

/**
 * Steps as a vertical timeline, such as a transaction's sign, submit and
 * confirm. Each step's marker shows its status, and the line under its label
 * says what it is doing, which assistive technology reads after the label;
 * the active step is the current one.
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
          <span
            aria-hidden="true"
            {...stylex.props(
              styles.connector,
              step.status === "done" && styles.connectorDone
            )}
          />
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
          </Text>
          <Text
            variant="caption"
            tone={step.status === "failed" ? "danger" : "muted"}
          >
            <VisuallyHidden>, </VisuallyHidden>
            {step.state ?? statusLabels[step.status]}
          </Text>
          {step.description !== undefined && (
            <Text variant="caption" tone="muted">
              {step.description}
            </Text>
          )}
          {(step.link !== undefined || step.action !== undefined) && (
            <span {...stylex.props(styles.extras)}>
              <Stack direction="row" align="center" gap={12} wrap>
                {step.link !== undefined && (
                  <Text variant="caption" numeric>
                    <ExternalLink
                      href={step.link.href}
                      newTabLabel={step.link.newTabLabel}
                    >
                      {step.link.context !== undefined && (
                        <VisuallyHidden>{`${step.link.context}, `}</VisuallyHidden>
                      )}
                      {step.link.label}
                    </ExternalLink>
                  </Text>
                )}
                {step.action !== undefined && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={step.action.onClick}
                    loading={step.action.loading ?? false}
                    {...(step.action.hostHook === undefined
                      ? {}
                      : { hostHook: step.action.hostHook })}
                  >
                    {step.action.label}
                  </Button>
                )}
              </Stack>
            </span>
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
      return <Spinner size="lg" />;
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
    paddingBottom: { default: space[20], ":last-child": 0 },
  },
  // Runs from each marker down to the next one, through the step's lines.
  connector: {
    backgroundColor: color.border,
    position: "absolute",
    bottom: 0,
    left: `calc(${stepMarkerSize.md} / 2 - ${borderWidth.thick} / 2)`,
    top: stepMarkerSize.md,
    width: borderWidth.thick,
  },
  // A finished step's connector leads on in the accent, as far as it got.
  connectorDone: { backgroundColor: color.accent },
  marker: {
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    alignItems: "center",
    boxSizing: "border-box",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    height: stepMarkerSize.md,
    width: stepMarkerSize.md,
  },
  // The label's first line sits centred on the marker.
  text: {
    gap: space[2],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    paddingTop: space[4],
  },
  extras: { paddingTop: space[6] },
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
