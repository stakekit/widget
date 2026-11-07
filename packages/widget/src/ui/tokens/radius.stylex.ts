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

/**
 * A button's corners by its control height: `lg` is the preset's `control`
 * radius, `md` five sixths of it and `sm` two thirds (8, 10 and 12 by
 * default), so a small button keeps the same curve rather than reading as a
 * pill. The theme root derives them from `radius.control` beside the preset's
 * and host's radius, so they follow both; these defaults are the default
 * preset's.
 */
export const controlRadius = stylex.defineVars({
  sm: "8px",
  md: "10px",
  lg: "12px",
});
