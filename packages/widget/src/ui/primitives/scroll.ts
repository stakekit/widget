import * as stylex from "@stylexjs/stylex";

/**
 * What every element that scrolls with the browser's own scrollbar applies
 * beside its `overflow`. `stableGutter` keeps the scrollbar's gutter whether
 * or not the content overflows, so content that grows past the edge, such as
 * a disclosure opening or a list filling, never narrows and shifts when the
 * scrollbar appears, nor widens when it goes. An overlay scrollbar, such as
 * macOS's default, takes no gutter, so there it changes nothing.
 * `ScrollArea`, whose own overlay scrollbar hides the browser's, keeps its
 * gutter as padding instead.
 */
export const scrollStyles = stylex.create({
  stableGutter: { scrollbarGutter: "stable" },
});
