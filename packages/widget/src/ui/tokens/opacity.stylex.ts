import * as stylex from "@stylexjs/stylex";

/**
 * `disabled` fades a control that cannot be used, such as a button or a
 * switch, to its look at 40%: it keeps its variant and state, so a disabled
 * primary button still reads as the primary action and a disabled switch as
 * on or off, yet it clearly stands apart from one that can be used.
 */
export const opacity = stylex.defineConsts({
  disabled: "0.4",
});
