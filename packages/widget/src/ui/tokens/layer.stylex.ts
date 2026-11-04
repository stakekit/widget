import * as stylex from "@stylexjs/stylex";

/**
 * Stacking layers for popups, all inside the portal container. The Widget root
 * is its own stacking context, so these never compete with host z-indices.
 * Popups that open from a control (dropdown, tooltip) sit above the modal, so
 * a Select or Tooltip inside a Modal renders on top of it.
 * Numbers, because StyleX types `zIndex` as a number.
 */
export const layer = stylex.defineConsts({
  // In-flow content that sticks over the rows scrolling under it, such as a
  // list's group title. Below every popup.
  sticky: 1,
  overlay: 10,
  modal: 20,
  dropdown: 30,
  toast: 40,
  tooltip: 50,
} as const);
