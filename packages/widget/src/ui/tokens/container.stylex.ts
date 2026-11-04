import * as stylex from "@stylexjs/stylex";

/**
 * Container sizes, the only thresholds for in-Widget layout. Each query
 * applies from its width up and reads the nearest size container: the Widget
 * root is one. The split view expands above 800px.
 */
export const container = stylex.defineConsts({
  sm: "@container (min-width: 400px)",
  md: "@container (min-width: 520px)",
  split: "@container (min-width: 801px)",
});
