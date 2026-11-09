import * as stylex from "@stylexjs/stylex";
import { scrollAreaMaxHeight } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { scrollFadeVars } from "./scroll-area.stylex";

/**
 * How a scrolling pane, `ScrollArea`'s viewport or `VirtualList`, presents
 * its scroll; each pane measures and scrolls itself. `pane` keeps the scroll
 * from chaining to the page behind it and fades each edge over up to
 * `space[24]`, by how far the content runs past it (`scrollFadeVars`, which
 * the pane sets), so a fade shows only where content is cut off. While the
 * pane itself has keyboard focus the fades lift, so its ring, drawn inside
 * the edge the mask would cut, shows whole. Scrolling a control into view,
 * as Tab does, brings it clear of a fade.
 */
export const scrollPaneStyles = stylex.create({
  pane: {
    overscrollBehavior: "contain",
    scrollPaddingBlock: space[24],
    maskImage: {
      default: `linear-gradient(to bottom, transparent, black min(${space[24]}, ${scrollFadeVars.start}), black calc(100% - min(${space[24]}, ${scrollFadeVars.end})), transparent)`,
      ":focus-visible": "none",
    },
    maskRepeat: "no-repeat",
  },
});

/** The height caps a scrolling pane takes; unset, it fills its parent. */
export const scrollPaneMaxHeightStyles = stylex.create({
  sm: { height: "auto", maxHeight: scrollAreaMaxHeight.sm },
  md: { height: "auto", maxHeight: scrollAreaMaxHeight.md },
  lg: { height: "auto", maxHeight: scrollAreaMaxHeight.lg },
});
