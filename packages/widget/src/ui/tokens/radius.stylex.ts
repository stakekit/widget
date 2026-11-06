import * as stylex from "@stylexjs/stylex";

/**
 * Radius roles. `controlInner` rounds segments inside a control.
 * `pillControl` rounds a pill-shaped control (a chip, the tabs' pill bar and
 * its segments, a token or wallet trigger): fully by default, and as a preset's
 * controls where its corners are tighter. `pill` stays fully rounded, for
 * round marks such as avatars, spinners, dots and switches.
 */
export const radius = stylex.defineVars({
  badge: "6px",
  control: "12px",
  controlInner: "8px",
  card: "16px",
  overlay: "20px",
  shell: "20px",
  pill: "9999px",
  pillControl: "9999px",
});
