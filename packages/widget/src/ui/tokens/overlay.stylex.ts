import * as stylex from "@stylexjs/stylex";

/** Overlay dimensions: dialog width and height caps, popup width limits. */
export const overlaySize = stylex.defineConsts({
  dialogWidth: "440px",
  // A dialog's height cap: a long list scrolls in a dialog that keeps its
  // scale in a tall viewport, and a sheet leaves the page in view above it.
  dialogMaxHeight: "min(560px, 80dvh)",
  sheetMaxHeight: "75dvh",
  // A `page` dialog's height: it leaves the scrim visible around a centered
  // dialog and above a sheet.
  pageDialogHeight: "calc(100dvh - 48px)",
  pageSheetHeight: "calc(100dvh - 32px)",
  // Viewport inset of a centered dialog on each side.
  dialogInset: "24px",
  tooltipMaxWidth: "240px",
  selectMaxHeight: "320px",
  menuMinWidth: "180px",
  popoverMaxWidth: "280px",
  // A dialog that asks to confirm one decision.
  alertDialogWidth: "360px",
  // How far a sheet or dialog travels as it enters and leaves.
  enterOffset: "16px",
} as const);
