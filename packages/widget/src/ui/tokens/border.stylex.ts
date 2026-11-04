import * as stylex from "@stylexjs/stylex";

/** Stroke widths: `thin` for borders, `thick` for spinners and rings. */
export const borderWidth = stylex.defineConsts({
  thin: "1px",
  thick: "2px",
});

/** The keyboard focus ring every interactive part draws on `:focus-visible`. */
export const focusRing = stylex.defineConsts({
  width: "2px",
  offset: "2px",
});
