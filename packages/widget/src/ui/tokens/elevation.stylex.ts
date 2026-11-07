import * as stylex from "@stylexjs/stylex";

/**
 * Shadows for raised surfaces (menus, popovers, the token trigger), overlays
 * and the Widget shell, cast in a deep shade of the accent's blue rather than
 * grey, so they sit with the blue-leaning neutrals. Selection is a ring plus
 * a tint, never a shadow. The dark scheme in `theme/color-schemes.ts`
 * replaces the shell's shadow with a border-colored ring.
 */
export const elevation = stylex.defineVars({
  raised: "0 1px 2px rgb(22 30 84 / 0.06), 0 2px 8px rgb(22 30 84 / 0.08)",
  overlay: "0 12px 32px rgb(22 30 84 / 0.18)",
  shell: "0 8px 28px rgb(22 30 84 / 0.10)",
});
