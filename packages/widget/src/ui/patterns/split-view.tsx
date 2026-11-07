import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { ScrollArea } from "../components/scroll-area";
import { scrollAreaVars } from "../components/scroll-area.stylex";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { container } from "../tokens/container.stylex";
import {
  containerWidth,
  gridTrack,
  splitPaneMinHeight,
} from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";

type SplitViewProps = {
  /** The main pane, such as a form; capped at the aside width when split. */
  readonly primary: ReactNode;
  /**
   * The pane beside it, such as the details of the form's selection. Split,
   * it takes the primary pane's height, at least a set minimum, and scrolls
   * what overflows it.
   */
  readonly secondary: ReactNode;
  /** Names the secondary pane's scrolling region. */
  readonly secondaryLabel: string;
};

/**
 * Two panes side by side from the `split` container size up, divided by a
 * rule. Narrower, they stack in one centred column no wider than the `md`
 * container size, the secondary pane under the primary one past a rule, at
 * their full height. Without both panes, it shows the one it has. It grows
 * into the rest of its column, such as a frame's minimum height. Split, the
 * secondary pane never sets the split view's height: it scrolls within the
 * primary pane's height, or its minimum when that is taller. Each pane is a
 * size container, so what it holds lays out by the pane's width; whether
 * the view splits reads the frame's.
 */
export const SplitView = ({
  primary,
  secondary,
  secondaryLabel,
}: SplitViewProps) => {
  const secondaryPane = (
    <div {...stylex.props(styles.fill, styles.container)}>
      <ScrollArea label={secondaryLabel}>{secondary}</ScrollArea>
    </div>
  );

  if (!primary || !secondary) {
    return (
      <div {...stylex.props(styles.root)}>
        <div
          {...stylex.props(
            styles.pane,
            primary ? styles.container : styles.bounded
          )}
        >
          {primary || secondaryPane}
        </div>
      </div>
    );
  }

  return (
    <div {...stylex.props(styles.root)}>
      <div {...stylex.props(styles.pane, styles.container, styles.primary)}>
        {primary}
      </div>
      <span aria-hidden="true" {...stylex.props(styles.rule)} />
      <div {...stylex.props(styles.pane, styles.bounded)}>{secondaryPane}</div>
    </div>
  );
};

const styles = stylex.create({
  // Grows into the rest of the page, so both panes reach its foot. Stacked,
  // a readable column centred in the page rather than its full width.
  root: {
    gap: space[24],
    marginInline: "auto",
    alignItems: "stretch",
    display: "flex",
    flexDirection: { default: "column", [container.split]: "row" },
    flexGrow: 1,
    maxWidth: { default: containerWidth.md, [container.split]: "none" },
    minWidth: 0,
    width: "100%",
  },
  // A pane's own queries still read the frame; those of what it holds read
  // the pane. The secondary pane's container is its scrolling fill, whose
  // own position reads the frame too.
  container: {
    containerType: "inline-size",
  },
  pane: {
    display: "flex",
    flexBasis: { default: "auto", [container.split]: 0 },
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
  },
  // Split, the secondary pane's content leaves the flow, so the pane's
  // height is the row's: the primary pane's, or the minimum when that is
  // taller. Stacked, it keeps its content's height.
  bounded: {
    position: "relative",
    minHeight: { default: 0, [container.split]: splitPaneMinHeight.secondary },
  },
  // Stacked, the secondary pane never scrolls, so its scrolling region keeps
  // no gutter and its content is as wide as the primary pane's.
  fill: {
    [scrollAreaVars.restingGutter]: {
      default: space[0],
      [container.split]: space[8],
    },
    inset: { default: "auto", [container.split]: 0 },
    display: "flex",
    flexDirection: "column",
    position: { default: "static", [container.split]: "absolute" },
  },
  primary: {
    maxWidth: { default: "none", [container.split]: gridTrack.splitAside },
  },
  // A row between the stacked panes; a column between the split ones.
  rule: {
    alignSelf: "stretch",
    backgroundColor: color.border,
    flexShrink: 0,
    height: { default: borderWidth.thin, [container.split]: "auto" },
    width: { default: "auto", [container.split]: borderWidth.thin },
  },
});
