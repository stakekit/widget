import * as stylex from "@stylexjs/stylex";

/**
 * Shadows for raised surfaces (menus, popovers, the token trigger), overlays
 * and the Widget shell. Selection is a ring plus a tint, never a shadow. The
 * dark scheme in `theme/color-schemes.ts` replaces the shell's shadow with a
 * border-colored ring.
 */
export const elevation = stylex.defineVars({
  raised: "0 1px 2px rgb(9 9 11 / 0.06), 0 2px 6px rgb(9 9 11 / 0.06)",
  overlay: "0 12px 32px rgb(9 9 11 / 0.16)",
  shell: "0 8px 24px rgb(9 9 11 / 0.08)",
});
