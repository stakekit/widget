import * as stylex from "@stylexjs/stylex";

/** Stroke widths: `thin` for borders, `thick` for spinners and rings. */
export const borderWidth = stylex.defineConsts({
  thin: "1px",
  thick: "2px",
});

/**
 * The keyboard focus ring every interactive part draws on `:focus-visible`.
 * `insetOffset` draws it inside the edge, for list rows a scrolling list
 * would otherwise clip.
 */
export const focusRing = stylex.defineConsts({
  width: "2px",
  offset: "2px",
  insetOffset: "-2px",
});

/** The ring that marks a selected surface, drawn inside its edge. */
export const selectionRing = stylex.defineConsts({
  width: "2px",
  offset: "-2px",
});
