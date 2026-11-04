import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { focusRingStyles } from "../components/focus-ring";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { container } from "../tokens/container.stylex";
import { motion } from "../tokens/motion.stylex";
import { gutter } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { gridTrack } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

/** The two panes of a split view. */
export type SplitViewSide = "primary" | "secondary";

type SplitViewProps = {
  /** The main pane, such as a form; capped at the aside width when split. */
  readonly primary: ReactNode;
  /** The pane beside it, such as the details of the form's selection. */
  readonly secondary: ReactNode;
  /** Names the bar that reveals the primary pane while collapsed. */
  readonly primaryBarLabel: string;
  /** Names the bar that reveals the secondary pane while collapsed. */
  readonly secondaryBarLabel: string;
  /** The pane shown while collapsed; unset, the split view keeps its own. */
  readonly activeSide?: SplitViewSide;
  readonly onActiveSideChange?: (side: SplitViewSide) => void;
};

/**
 * Two panes side by side from the `split` container size up, divided by a
 * rule. Narrower, it shows one pane at a time and a bar beside it, named for
 * the other pane, that swaps them. Without both panes, it shows the one it
 * has.
 */
export const SplitView = ({
  primary,
  secondary,
  primaryBarLabel,
  secondaryBarLabel,
  activeSide: controlledSide,
  onActiveSideChange,
}: SplitViewProps) => {
  const [ownSide, setOwnSide] = useState<SplitViewSide>("primary");
  // Only a swap slides the shown pane in, not the first render.
  const [swapped, setSwapped] = useState(false);
  const activeSide = controlledSide ?? ownSide;

  if (!primary || !secondary) {
    return (
      <div {...stylex.props(styles.root)}>
        <div {...stylex.props(styles.pane)}>{primary || secondary}</div>
      </div>
    );
  }

  const primaryActive = activeSide === "primary";
  const revealLabel = primaryActive ? secondaryBarLabel : primaryBarLabel;

  return (
    <div {...stylex.props(styles.root)}>
      <div
        {...stylex.props(
          styles.pane,
          styles.primary,
          primaryActive
            ? swapped && styles.enterFromStart
            : styles.collapsedHidden
        )}
      >
        {primary}
      </div>
      <button
        type="button"
        aria-label={revealLabel}
        onClick={() => {
          const next = primaryActive ? "secondary" : "primary";
          setOwnSide(next);
          setSwapped(true);
          onActiveSideChange?.(next);
        }}
        {...stylex.props(
          styles.bar,
          focusRingStyles.visible,
          primaryActive ? styles.barBleedEnd : styles.barBleedStart
        )}
      >
        <span
          {...stylex.props(styles.barIcon, !primaryActive && styles.flipped)}
        >
          <Icon name="CaretLeftIcon" size="sm" />
        </span>
        <span aria-hidden="true" {...stylex.props(styles.barLabel)}>
          {revealLabel}
        </span>
      </button>
      <span aria-hidden="true" {...stylex.props(styles.rule)} />
      <div
        {...stylex.props(
          styles.pane,
          primaryActive
            ? styles.collapsedHidden
            : swapped && styles.enterFromEnd
        )}
      >
        {secondary}
      </div>
    </div>
  );
};

const enterFromStart = stylex.keyframes({
  from: { opacity: 0, transform: `translateX(calc(-1 * ${space[16]}))` },
  to: { opacity: 1, transform: "none" },
});

const enterFromEnd = stylex.keyframes({
  from: { opacity: 0, transform: `translateX(${space[16]})` },
  to: { opacity: 1, transform: "none" },
});

const styles = stylex.create({
  root: {
    gap: space[24],
    alignItems: "stretch",
    display: "flex",
    flexDirection: "row",
    minWidth: 0,
    width: "100%",
  },
  pane: {
    display: "flex",
    flexBasis: 0,
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
  },
  primary: {
    maxWidth: { default: "none", [container.split]: gridTrack.splitAside },
  },
  // Collapsed, the pane not shown leaves the layout.
  collapsedHidden: {
    display: { default: "none", [container.split]: "flex" },
  },
  // Collapsed, the pane shown slides in from its side.
  enterFromStart: {
    animationDuration: { default: motion.slow, [container.split]: "0s" },
    animationName: enterFromStart,
    animationTimingFunction: motion.easing,
  },
  enterFromEnd: {
    animationDuration: { default: motion.slow, [container.split]: "0s" },
    animationName: enterFromEnd,
    animationTimingFunction: motion.easing,
  },
  bar: {
    margin: 0,
    borderRadius: radius.control,
    borderStyle: "none",
    gap: space[8],
    paddingBlock: space[12],
    paddingInline: 0,
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: {
      default: color.surface,
      ":hover": color.surfaceHover,
    },
    color: color.text,
    cursor: "pointer",
    display: { default: "flex", [container.split]: "none" },
    flexDirection: "column",
    flexShrink: 0,
    justifyContent: "center",
    transitionDuration: motion.fast,
    transitionProperty: "background-color",
    transitionTimingFunction: motion.easing,
    width: space[32],
  },
  // The bar reaches into the gutter on the side it sits, short of the edge.
  barBleedEnd: {
    marginInlineEnd: `calc(${space[8]} - ${gutter.size})`,
  },
  barBleedStart: {
    marginInlineStart: `calc(${space[8]} - ${gutter.size})`,
  },
  barIcon: {
    display: "flex",
    transitionDuration: motion.base,
    transitionProperty: "transform",
    transitionTimingFunction: motion.easing,
  },
  flipped: { transform: "rotate(180deg)" },
  barLabel: {
    fontFamily: font.sans,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.label,
    whiteSpace: "nowrap",
    writingMode: "vertical-rl",
  },
  rule: {
    alignSelf: "stretch",
    backgroundColor: color.border,
    display: { default: "none", [container.split]: "block" },
    flexShrink: 0,
    width: borderWidth.thin,
  },
});
