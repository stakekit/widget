import * as stylex from "@stylexjs/stylex";

/**
 * `disabled` fades a control that cannot be used, such as a secondary button
 * or a switch, to its look at 40%: it keeps its variant and state, so a
 * disabled switch still reads as on or off, yet it clearly stands apart from
 * one that can be used. A disabled primary or soft button takes a neutral
 * fill instead, so its label stays readable.
 * `halo` fades a `Spot`'s ring to half its disc's tint.
 */
export const opacity = stylex.defineConsts({
  disabled: "0.4",
  halo: "0.5",
});
