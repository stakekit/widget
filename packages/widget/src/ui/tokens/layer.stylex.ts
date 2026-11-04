import * as stylex from "@stylexjs/stylex";

/**
 * Stacking layers for popups, all inside the portal container. The Widget root
 * is its own stacking context, so these never compete with host z-indices.
 * Popups that open from a control (dropdown, tooltip) sit above the modal, so
 * a Select or Tooltip inside a Modal renders on top of it.
 * Numbers, because StyleX types `zIndex` as a number.
 */
export const layer = stylex.defineConsts({
  overlay: 10,
  modal: 20,
  dropdown: 30,
  toast: 40,
  tooltip: 50,
} as const);
