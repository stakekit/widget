import * as stylex from "@stylexjs/stylex";

import { Icon } from "../primitives/icon";
import { Text } from "../primitives/text";
import { VisuallyHidden } from "../primitives/visually-hidden";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { avatarSize, stepMarkerSize } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { ExternalLink } from "./external-link";

/**
 * Where a step stands: waiting its turn, under way, waiting for the wallet's
 * signature, failed, cancelled by the user, or done.
 */
type StepStatus =
  | "idle"
  | "active"
  | "signing"
  | "failed"
  | "cancelled"
  | "done";

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
  /**
   * How far an active step got: its connector to the next step fills a third
   * while it is submitted and two thirds while it is confirmed. Read for an
   * active step only.
   */
  readonly stage?: StepStage;
  /** Shown under the state, such as how long it takes or what went wrong. */
  readonly description?: string;
  /**
   * What the step left behind, such as a sent transaction's shortened hash:
   * shown before its link, in tabular figures.
   */
  readonly reference?: string;
  /** A link under the step, such as its transaction on a block explorer. */
  readonly link?: StepLink;
};

type StepStage = "submitting" | "confirming";

type StepLink = {
  readonly href: string;
  /** Says where it leads, such as "View on explorer". */
  readonly label: string;
  /** Names the new-tab icon, such as "opens in a new tab". */
  readonly newTabLabel: string;
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
 * the active or signing step is the current one. A signing step's marker
 * pulses a halo, an active step's turns an arc around it while its connector
 * fills by its stage; under reduced motion both hold still. Markers sit
 * centred in a column as wide as an `md` avatar, so a heading's avatar over
 * the timeline lines up with them.
 */
export const Steps = ({ steps, label, statusLabels }: StepsProps) => (
  <ol aria-label={label} {...stylex.props(styles.list)}>
    {steps.map((step, index) => (
      <li
        key={step.id}
        aria-current={
          step.status === "active" || step.status === "signing"
            ? "step"
            : undefined
        }
        {...stylex.props(styles.step)}
      >
        {index < steps.length - 1 && (
          <span aria-hidden="true" {...stylex.props(styles.connector)}>
            <span
              data-step-part="connector-fill"
              {...stylex.props(styles.connectorFill, connectorFill(step))}
            />
          </span>
        )}
        <span {...stylex.props(styles.marker, markerStyles[step.status])}>
          {step.status === "signing" && (
            <>
              <span
                aria-hidden="true"
                data-step-part="halo"
                {...stylex.props(styles.halo)}
              />
              <span
                aria-hidden="true"
                {...stylex.props(styles.halo, styles.haloEcho)}
              />
            </>
          )}
          {step.status === "active" && (
            <span
              aria-hidden="true"
              data-step-part="arc"
              {...stylex.props(styles.arc)}
            />
          )}
          <span
            {...stylex.props(
              styles.glyph,
              step.status === "done" && styles.glyphDone
            )}
          >
            <StepMarker status={step.status} />
          </span>
        </span>
        <span {...stylex.props(styles.text)}>
          <Text
            tone={step.status === "idle" ? "muted" : "default"}
            weight="medium"
          >
            {step.label}
          </Text>
          <Text variant="caption" tone={stateTone[step.status]}>
            <VisuallyHidden>, </VisuallyHidden>
            {step.state ?? statusLabels[step.status]}
          </Text>
          {step.description !== undefined && (
            <Text variant="caption" tone="muted">
              {step.description}
            </Text>
          )}
          {(step.reference !== undefined || step.link !== undefined) && (
            <span {...stylex.props(styles.extras)}>
              {step.reference !== undefined && (
                <Text variant="caption" tone="muted" numeric>
                  {step.reference}
                </Text>
              )}
              {step.link !== undefined && (
                <Text variant="caption">
                  <ExternalLink
                    href={step.link.href}
                    newTabLabel={step.link.newTabLabel}
                  >
                    {step.link.label}
                  </ExternalLink>
                </Text>
              )}
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
      return <Icon name="CheckIcon" size="sm" />;
    case "signing":
      return <Icon name="WalletIcon" size="sm" />;
    case "failed":
      return <Icon name="XIcon" size="sm" />;
    // Stopped by the user: a dash, as nothing went wrong.
    case "cancelled":
      return <Icon name="MinusIcon" size="sm" />;
    case "active":
    case "idle":
      return null;
  }
};

/** The state line's tone: only a failure reads as an error. */
const stateTone = {
  idle: "muted",
  active: "muted",
  signing: "muted",
  failed: "danger",
  cancelled: "muted",
  done: "muted",
} as const satisfies Record<StepStatus, "muted" | "danger">;

/** How much of a step's connector is filled: all once it is done. */
const connectorFill = ({ status, stage }: Step) => {
  if (status === "done") return fillStyles.done;
  if (status !== "active") return fillStyles.empty;
  return stage === "confirming" ? fillStyles.confirming : fillStyles.submitting;
};

// A signature's halo: accent ripples breathe out from the marker and fade;
// held still, one rests as a soft ring around it.
const haloPulse = stylex.keyframes({
  from: { opacity: 0.45, transform: "scale(1)" },
  to: { opacity: 0, transform: "scale(2.2)" },
});

const arcSpin = stylex.keyframes({
  to: { transform: "rotate(360deg)" },
});

// A step that just finished pops its check in.
const donePop = stylex.keyframes({
  "0%": { opacity: 0, transform: "scale(0.6)" },
  "60%": { opacity: 1, transform: "scale(1.12)" },
  "100%": { opacity: 1, transform: "scale(1)" },
});

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
  // Runs from each marker down to the next one, through the step's lines,
  // down the middle of the marker column.
  connector: {
    overflow: "hidden",
    backgroundColor: color.border,
    position: "absolute",
    bottom: 0,
    left: `calc(${avatarSize.md} / 2 - ${borderWidth.medium} / 2)`,
    top: stepMarkerSize.md,
    width: borderWidth.medium,
  },
  // Fills from the marker down: accent while the step is under way, the
  // success tone once it is done.
  connectorFill: {
    backgroundColor: color.accent,
    display: "block",
    transformOrigin: "top",
    transitionDuration: motion.slow,
    transitionProperty: "transform, background-color",
    transitionTimingFunction: motion.easing,
    height: "100%",
    width: "100%",
  },
  // Centred in a column as wide as an `md` avatar.
  marker: {
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.medium,
    marginInline: `calc((${avatarSize.md} - ${stepMarkerSize.md}) / 2)`,
    alignItems: "center",
    boxSizing: "border-box",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    position: "relative",
    height: stepMarkerSize.md,
    width: stepMarkerSize.md,
  },
  // Painted over the halo and the arc.
  glyph: { display: "flex", position: "relative" },
  // A step that just finished pops its check in; the marker keeps its size.
  glyphDone: {
    animationDuration: motion.slow,
    animationName: donePop,
    animationTimingFunction: motion.easing,
  },
  halo: {
    inset: 0,
    borderColor: color.accent,
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.medium,
    animationDuration: motion.halo,
    animationIterationCount: "infinite",
    animationName: haloPulse,
    animationTimingFunction: motion.easing,
    backgroundColor: color.accent,
    boxSizing: "border-box",
    opacity: 0.2,
    pointerEvents: "none",
    position: "absolute",
    transform: "scale(1.5)",
  },
  // A second ripple half a breath behind, so one is always on its way out.
  haloEcho: { animationDelay: motion.haloEcho },
  // The marker's ring: a thick accent quarter turning on a light track. The
  // accent arc carries the meaning, so it is what holds 3:1 on every surface.
  arc: {
    inset: 0,
    borderColor: color.border,
    borderRadius: radius.pill,
    borderStyle: "solid",
    borderWidth: borderWidth.thick,
    animationDuration: motion.spin,
    animationIterationCount: "infinite",
    animationName: arcSpin,
    animationTimingFunction: motion.linear,
    boxSizing: "border-box",
    pointerEvents: "none",
    position: "absolute",
    borderTopColor: color.accent,
  },
  // The label's first line sits centred on the marker.
  text: {
    gap: space[2],
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    paddingTop: space[2],
  },
  // A sent transaction's hash beside its explorer link.
  extras: {
    alignItems: "baseline",
    columnGap: space[8],
    display: "flex",
    flexWrap: "wrap",
    paddingTop: space[6],
  },
});

const fillStyles = stylex.create({
  empty: { transform: "scaleY(0)" },
  submitting: { transform: "scaleY(0.33)" },
  confirming: { transform: "scaleY(0.67)" },
  // A finished step's connector leads on in the success tone, as far as it
  // got; the accent stays with the step under way.
  done: { backgroundColor: color.success, transform: "none" },
});

// Every marker is a 24px disc: waiting is a ring on the surface, in
// `textMuted` so the ring alone reaches 3:1 (WCAG 1.4.11), the step under
// way an accent arc turning on its ring, a signature a wallet on the accent
// tint, done and failed an outline check and cross in their status tones,
// and a step the user cancelled a muted dash on the waiting ring, since
// nothing went wrong. The arc and the halo fill the marker, which draws no
// border of its own under them.
const markerStyles = stylex.create({
  idle: { borderColor: color.textMuted, backgroundColor: color.surface },
  active: { borderWidth: 0, color: color.accentText },
  // The accent ring holds the marker against its halo.
  signing: {
    borderColor: color.accent,
    backgroundColor: color.accentSoft,
    color: color.accentText,
  },
  failed: { borderColor: color.danger, color: color.danger },
  cancelled: {
    borderColor: color.textMuted,
    backgroundColor: color.surface,
    color: color.textMuted,
  },
  done: { borderColor: color.success, color: color.success },
});
