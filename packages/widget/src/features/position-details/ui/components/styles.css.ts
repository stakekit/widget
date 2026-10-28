import { style } from "@vanilla-extract/css";

export const noWrap = style({ whiteSpace: "nowrap" });

// The CTA keeps a single-line label; when it and the text can't share a row
// (narrow widget, long translations) the CTA wraps below, right-aligned.
export const actionBlockText = style({
  flex: "1 1 8rem",
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const actionBlockCta = style({ flexShrink: 0, marginLeft: "auto" });
