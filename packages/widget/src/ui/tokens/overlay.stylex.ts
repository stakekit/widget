import * as stylex from "@stylexjs/stylex";

/** Overlay dimensions: dialog width and height caps, popup width limits. */
export const overlaySize = stylex.defineConsts({
  dialogWidth: "440px",
  // Leaves the scrim visible around a centered dialog and above a sheet.
  dialogMaxHeight: "calc(100dvh - 48px)",
  sheetMaxHeight: "calc(100dvh - 32px)",
  // Viewport inset of a centered dialog on each side.
  dialogInset: "24px",
  tooltipMaxWidth: "240px",
  selectMaxHeight: "320px",
  // How far a sheet or dialog travels as it enters and leaves.
  enterOffset: "16px",
} as const);
