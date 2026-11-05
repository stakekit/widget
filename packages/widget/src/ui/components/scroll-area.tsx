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

type ScrollAreaProps = {
  /** Names the scrolling region, which keyboard users focus to scroll. */
  readonly label: string;
  /** Caps the height; unset, the area fills its parent's height. */
  readonly maxHeight?: keyof typeof maxHeightStyles;
  readonly children: ReactNode;
};

/**
 * A region that scrolls its content vertically with a thin overlay
 * scrollbar, and keeps the scroll from chaining to the page behind it. While
 * it overflows, the content keeps clear of the scrollbar's gutter. Arrow
 * keys scroll it once focused.
 */
export const ScrollArea = ({ label, maxHeight, children }: ScrollAreaProps) => (
  <BaseScrollArea.Root
    {...stylex.props(styles.root, maxHeight && maxHeightStyles[maxHeight])}
  >
    <BaseScrollArea.Viewport
      role="region"
      aria-label={label}
      tabIndex={0}
      {...stylex.props(styles.viewport, focusRingStyles.visible)}
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
  // The gutter is the scrollbar's width, so nothing sits under it. Base UI
  // gives the content `min-width: fit-content`; sized as if empty across, the
  // content takes the viewport's width and no more, so a long line, such as
  // truncated text, truncates rather than scrolling the area sideways. While
  // it overflows, the end leaves room for the ring of a control scrolled to it.
  content: {
    contain: "inline-size",
    paddingBlockEnd: {
      default: 0,
      ":is([data-has-overflow-y])": focusRing.extent,
    },
    paddingInlineEnd: { default: 0, ":is([data-has-overflow-y])": space[8] },
  },
  // Scrolling a control into view, as Tab does, leaves room for its ring.
  viewport: {
    borderRadius: radius.badge,
    overscrollBehavior: "contain",
    scrollPaddingBlock: focusRing.extent,
    flexGrow: 1,
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
