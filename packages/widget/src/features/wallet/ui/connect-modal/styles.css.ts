import { style } from "@vanilla-extract/css";
import { vars } from "../../../../shared/styles/theme/contract.css";
import { mobile } from "../wallet-dialog/styles.css";

export const body = style({
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minHeight: 0,
  padding: "16px 16px 0",
});

export const header = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexShrink: 0,
});

export const headerSlot = style({
  display: "flex",
  flexShrink: 0,
  width: 28,
  selectors: { [mobile]: { width: 30 } },
});

export const title = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  flex: 1,
  minWidth: 0,
  textAlign: "center",
});

export const error = style({
  margin: "0 8px",
  color: vars.color.textDanger,
  fontSize: 14,
  fontWeight: 500,
  textAlign: "center",
});

export const list = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: "1 1 auto",
  minHeight: 0,
  maxHeight: 456,
  padding: "2px 2px 8px",
  boxSizing: "border-box",
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  selectors: { [mobile]: { scrollbarWidth: "none" } },
});

export const group = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
});

export const groupHeading = style({
  margin: 0,
  padding: "8px 6px 4px",
  color: vars.color.textMuted,
  fontSize: 14,
  fontWeight: 700,
  lineHeight: "normal",
});

export const option = style({ textDecoration: "none" });

export const optionRow = style({
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
  fontSize: 16,
  fontWeight: 700,
  lineHeight: "normal",
});

export const optionTitle = style({
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const installHint = style({
  flexShrink: 0,
  color: vars.color.accent,
  fontSize: 14,
  fontWeight: 700,
});

/** A row whose wallet is still being detected: inert until it can connect or install. */
export const checkingOption = style({
  cursor: "default",
  ":hover": { background: "transparent" },
  ":active": { transform: "none" },
});

/** Neutral stand-in for the action a checking row will offer. */
export const checkingHint = style({
  flexShrink: 0,
  width: 44,
  height: 14,
  borderRadius: 7,
  background: vars.color.backgroundMuted,
});

export const disclaimer = style({
  flexShrink: 0,
  margin: 0,
  padding: "4px 16px 16px",
  color: vars.color.textMuted,
  fontSize: 12,
  fontWeight: 500,
  textAlign: "center",
});
