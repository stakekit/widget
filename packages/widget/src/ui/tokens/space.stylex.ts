import * as stylex from "@stylexjs/stylex";

/**
 * The 4px spacing grid, keyed by its px value, and the named `section` inset.
 * The gutter is a presentation setting (`presentation.stylex.ts`).
 */
export const space = stylex.defineConsts({
  0: "0px",
  2: "2px",
  4: "4px",
  6: "6px",
  8: "8px",
  12: "12px",
  16: "16px",
  20: "20px",
  24: "24px",
  32: "32px",
  40: "40px",
  48: "48px",
  64: "64px",
  section: "24px",
});
