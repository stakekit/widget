import * as stylex from "@stylexjs/stylex";

/**
 * Private to `Grid`: a responsive `columns` value carries one track list per
 * container size, so a larger size's value never replaces the base one
 * (StyleX merges per property and the last one wins). A grid given a
 * responsive value sets all four, so a nested grid never inherits its
 * parent's; a grid given a single value reads none of them.
 */
export const columnsVars = stylex.defineVars({
  base: "none",
  sm: "none",
  md: "none",
  split: "none",
});
