import * as stylex from "@stylexjs/stylex";

/**
 * The input query: `coarse` matches a touch screen's imprecise pointer, where
 * a control's hit area grows to `hitArea.coarse` without changing its look.
 */
export const pointer = stylex.defineConsts({
  coarse: "@media (pointer: coarse)",
} as const);
