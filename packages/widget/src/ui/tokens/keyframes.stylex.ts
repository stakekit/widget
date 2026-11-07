import * as stylex from "@stylexjs/stylex";

/** Keyframes more than one part plays; time them with the `motion` tokens. */
export const keyframes = stylex.defineVars({
  // Reveals its content from the left, as a pen draws a check.
  drawIn: stylex.keyframes({
    from: { clipPath: "inset(0 100% 0 0)" },
    to: { clipPath: "inset(0 0 0 0)" },
  }),
});
