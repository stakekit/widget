import * as stylex from "@stylexjs/stylex";

/**
 * Stroke widths: `thin` for borders, `medium` for step markers and their
 * connectors, `thick` for spinners and rings.
 */
export const borderWidth = stylex.defineConsts({
  thin: "1px",
  medium: "1.5px",
  thick: "2px",
});

/**
 * The keyboard focus ring every interactive part draws on `:focus-visible`:
 * a `width` line outside the edge, past an `offset` gap where the canvas
 * shows, so it never reads as the selection ring, which sits inside the edge
 * over a tint. `extent` is how far it reaches past the edge, its offset plus
 * its width: the room a scrolling container leaves when it scrolls a control
 * into view. A surface that can be selected and that a clipping or scrolling
 * container would cut the ring off from, such as a list row, draws it inside
 * the edge instead, as two lines and the gap between them (`insetStyle`,
 * `insetWidth` at `insetOffset`), where the selection ring is one line; a
 * focused selected surface draws the same two lines from the selection
 * ring's offset, the selection ring inside the edge and the focus ring
 * outside it.
 */
export const focusRing = stylex.defineConsts({
  width: "2px",
  offset: "2px",
  extent: "4px",
  insetStyle: "double",
  insetWidth: "6px",
  insetOffset: "-6px",
});

/** The ring that marks a selected surface, drawn inside its edge. */
export const selectionRing = stylex.defineConsts({
  width: "2px",
  offset: "-2px",
});

/**
 * A thin edge drawn just inside a part with `outline`, so its size holds:
 * `offset` pulls a `borderWidth.thin` outline in by its own width.
 */
export const insetEdge = stylex.defineConsts({
  offset: "-1px",
});
