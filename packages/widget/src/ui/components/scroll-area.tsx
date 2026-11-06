import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

import { focusRing } from "../tokens/border.stylex";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import { scrollAreaMaxHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { focusRingStyles } from "./focus-ring";
import { scrollAreaVars } from "./scroll-area.stylex";

type ScrollAreaProps = {
  /** Names the scrolling region, which keyboard users focus to scroll. */
  readonly label: string;
  /** Caps the height; unset, the area fills its parent's height. */
  readonly maxHeight?: keyof typeof maxHeightStyles;
  readonly children: ReactNode;
};

/**
 * A region that scrolls its content vertically with a thin overlay
 * scrollbar, and keeps the scroll from chaining to the page behind it. The
 * content always keeps clear of the scrollbar's gutter, so it never sits
 * under it, nor shifts when content growing past the edge brings the
 * scrollbar in. An edge that cuts content off fades it out, deeper the more
 * lies past it, so a pane reads as scrolling. Arrow keys scroll it once
 * focused.
 */
export const ScrollArea = ({ label, maxHeight, children }: ScrollAreaProps) => (
  <BaseScrollArea.Root
    {...stylex.props(styles.root, maxHeight && maxHeightStyles[maxHeight])}
  >
    <BaseScrollArea.Viewport
      role="region"
      aria-label={label}
      tabIndex={0}
      {...stylex.props(
        styles.viewport,
        focusRingStyles.visible,
        focusRingStyles.inset
      )}
    >
      <BaseScrollArea.Content {...stylex.props(styles.content)}>
        {children}
      </BaseScrollArea.Content>
    </BaseScrollArea.Viewport>
    <BaseScrollArea.Scrollbar {...stylex.props(styles.scrollbar)}>
      <BaseScrollArea.Thumb {...stylex.props(styles.thumb)} />
    </BaseScrollArea.Scrollbar>
  </BaseScrollArea.Root>
);

const styles = stylex.create({
  root: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    height: "100%",
    minHeight: 0,
  },
  // Base UI gives the content `min-width: fit-content`; sized as if empty
  // across, the content takes the viewport's width and no more, so a long
  // line, such as truncated text, truncates rather than scrolling the area
  // sideways. While it overflows, the end leaves room for the ring of a
  // control scrolled to it. It resets the resting gutter for any area
  // inside it.
  content: {
    [scrollAreaVars.restingGutter]: space[8],
    contain: "inline-size",
    paddingBlockEnd: {
      default: 0,
      ":is([data-has-overflow-y])": focusRing.extent,
    },
  },
  // Each edge fades over up to `space[24]`, by how far the content runs past
  // it (Base UI's overflow distances), so a fade shows only where content is
  // cut off. While the region itself has keyboard focus the fades lift, so
  // its ring, drawn inside the edge the mask would cut, shows whole.
  // Scrolling a control into view, as Tab does, brings it clear of a fade.
  // The end keeps the scrollbar's gutter, so nothing sits under it, whether
  // or not the content overflows, as `scrollStyles.stableGutter` keeps a
  // browser scrollbar's: content that grows past the edge never narrows and
  // shifts. Only a parent where the area never scrolls drops it.
  viewport: {
    borderRadius: radius.badge,
    overscrollBehavior: "contain",
    scrollPaddingBlock: space[24],
    flexGrow: 1,
    maskImage: {
      default: `linear-gradient(to bottom, transparent, black min(${space[24]}, var(--scroll-area-overflow-y-start, ${space[0]})), black calc(100% - min(${space[24]}, var(--scroll-area-overflow-y-end, ${space[0]}))), transparent)`,
      ":focus-visible": "none",
    },
    maskRepeat: "no-repeat",
    paddingInlineEnd: {
      default: scrollAreaVars.restingGutter,
      ":is([data-has-overflow-y])": space[8],
    },
    minHeight: 0,
  },
  scrollbar: {
    padding: space[2],
    display: "flex",
    opacity: {
      default: 0,
      ":is([data-hovering], [data-scrolling])": 1,
    },
    transitionDuration: motion.fast,
    transitionProperty: "opacity",
    transitionTimingFunction: motion.easing,
    width: space[8],
  },
  thumb: {
    borderRadius: radius.pill,
    backgroundColor: color.textSubtle,
    width: "100%",
  },
});

const maxHeightStyles = stylex.create({
  sm: { height: "auto", maxHeight: scrollAreaMaxHeight.sm },
  md: { height: "auto", maxHeight: scrollAreaMaxHeight.md },
  lg: { height: "auto", maxHeight: scrollAreaMaxHeight.lg },
});
