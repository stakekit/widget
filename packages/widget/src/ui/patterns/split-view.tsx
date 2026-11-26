import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { ScrollArea } from "../components/scroll-area";
import { scrollAreaVars } from "../components/scroll-area.stylex";
import { borderWidth } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { splitMarker } from "../tokens/container.stylex";
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
 * Two panes side by side while its `WidgetFrame` splits (`splitMarker`, from
 * the `split` container size up), divided by a rule. Narrower, they stack in
 * one centred column no wider than the `md` container size, the secondary
 * pane under the primary one past a rule, at their full height. Without both
 * panes, it shows the one it has. It grows into the rest of its column, such
 * as a frame's minimum height. Split, the secondary pane never sets the split
 * view's height: it scrolls within the primary pane's height, or its minimum
 * when that is taller. Each pane is a size container, so what it holds lays
 * out by the pane's width.
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

// Each split value applies while the frame splits, which the frame measures:
// `[stylex.when.ancestor("[data-sk-split]", splitMarker)]`.
const styles = stylex.create({
  // Grows into the rest of the page, so both panes reach its foot. Stacked,
  // a readable column centred in the page rather than its full width.
  root: {
    gap: space[24],
    marginInline: "auto",
    alignItems: "stretch",
    display: "flex",
    flexDirection: {
      default: "column",
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: "row",
    },
    flexGrow: 1,
    maxWidth: {
      default: containerWidth.md,
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: "none",
    },
    minWidth: 0,
    width: "100%",
  },
  // What a pane holds reads the pane's width in its own queries. The
  // secondary pane's container is its scrolling fill.
  container: {
    containerType: "inline-size",
  },
  pane: {
    display: "flex",
    flexBasis: {
      default: "auto",
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: 0,
    },
    flexDirection: "column",
    flexGrow: 1,
    minWidth: 0,
  },
  // Split, the secondary pane's content leaves the flow, so the pane's
  // height is the row's: the primary pane's, or the minimum when that is
  // taller. Stacked, it keeps its content's height.
  bounded: {
    position: "relative",
    minHeight: {
      default: 0,
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]:
        splitPaneMinHeight.secondary,
    },
  },
  // Stacked, the secondary pane never scrolls, so its scrolling region keeps
  // no gutter and its content is as wide as the primary pane's.
  fill: {
    [scrollAreaVars.restingGutter]: {
      default: space[0],
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: space[8],
    },
    inset: {
      default: "auto",
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: 0,
    },
    display: "flex",
    flexDirection: "column",
    position: {
      default: "static",
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: "absolute",
    },
  },
  primary: {
    maxWidth: {
      default: "none",
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]:
        gridTrack.splitAside,
    },
  },
  // A row between the stacked panes; a column between the split ones.
  rule: {
    alignSelf: "stretch",
    backgroundColor: color.border,
    flexShrink: 0,
    height: {
      default: borderWidth.thin,
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: "auto",
    },
    width: {
      default: "auto",
      [stylex.when.ancestor("[data-sk-split]", splitMarker)]: borderWidth.thin,
    },
  },
});
