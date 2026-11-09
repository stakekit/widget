import * as stylex from "@stylexjs/stylex";
import { space } from "../tokens/space.stylex";

/**
 * `ScrollArea`'s gutter while its content fits: its scrollbar's width, so
 * content that grows past the edge never narrows and shifts when the
 * scrollbar comes in. A parent in which the area takes its content's height
 * and so never scrolls, such as a stacked `SplitView` pane, sets it to 0, so
 * the content keeps its full width there. The area resets it for anything
 * inside it.
 */
export const scrollAreaVars = stylex.defineVars({
  restingGutter: space[8],
});

/**
 * How far a scrolling pane's content runs past its start and end edges,
 * which sets how deep each edge fades (`scrollPaneStyles.pane`). Each pane,
 * `ScrollArea` and `VirtualList`, sets them on itself from its own measure.
 */
export const scrollFadeVars = stylex.defineVars({
  start: space[0],
  end: space[0],
});
