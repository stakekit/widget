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
 * The keyboard focus ring every interactive part draws on `:focus-visible`.
 * `insetOffset` draws it inside the edge, for full-width parts a clipping or
 * scrolling container would otherwise cut it off. `extent` is how far a ring
 * drawn outside reaches past the edge, its offset plus its width: the room a
 * scrolling container leaves when it scrolls a control into view.
 */
export const focusRing = stylex.defineConsts({
  width: "2px",
  offset: "2px",
  insetOffset: "-2px",
  extent: "4px",
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
