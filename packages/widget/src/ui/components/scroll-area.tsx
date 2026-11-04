import { ScrollArea as BaseScrollArea } from "@base-ui/react/scroll-area";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
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
 * scrollbar, and keeps the scroll from chaining to the page behind it. Arrow
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
      {children}
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
  viewport: {
    borderRadius: radius.badge,
    overscrollBehavior: "contain",
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
