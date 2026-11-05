import * as stylex from "@stylexjs/stylex";

/**
 * Container sizes, the only thresholds for in-Widget layout. Each query
 * applies from its width up and reads the nearest size container: the Widget
 * root is one. The split view expands above 960px; narrower, the Dashboard
 * stacks in one column.
 */
export const container = stylex.defineConsts({
  sm: "@container (min-width: 400px)",
  md: "@container (min-width: 520px)",
  split: "@container (min-width: 961px)",
});

/**
 * The container sizes as bands, each from its size up to the next. A property
 * that reads a value at more than one size uses these: queries of equal
 * specificity that overlap resolve by source order, which StyleX does not
 * guarantee, so a smaller size's value could win over a larger one's.
 */
export const containerBand = stylex.defineConsts({
  sm: "@container (400px <= width < 520px)",
  md: "@container (520px <= width < 961px)",
  split: "@container (min-width: 961px)",
});
