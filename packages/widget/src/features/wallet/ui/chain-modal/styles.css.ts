import { style } from "@vanilla-extract/css";
import { vars } from "../../../../shared/styles/theme/contract.css";
import { mobile } from "../wallet-dialog/styles.css";

export const chainBody = style({
  display: "flex",
  flexDirection: "column",
  gap: 14,
  padding: "16px 16px 0",
  minHeight: 0,
});

export const header = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  flexShrink: 0,
});

export const headerSpacer = style({
  display: "none",
  selectors: { [mobile]: { display: "block", width: 30 } },
});

export const dialogHeading = style({ padding: "4px 0 0 8px" });

export const wrongNetwork = style({
  margin: "0 8px",
  color: vars.color.textMuted,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: "normal",
  selectors: { [mobile]: { textAlign: "center" } },
});

export const chainList = style({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "2px 2px 16px",
  minHeight: 0,
  maxHeight: 456,
  boxSizing: "border-box",
  overflowY: "auto",
  overflowX: "hidden",
  overscrollBehavior: "contain",
  selectors: {
    [mobile]: { scrollbarWidth: "none" },
  },
});

export const chainRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: 16,
  fontWeight: 700,
  lineHeight: "normal",
});

export const disabledRow = style({ opacity: 0.4 });

export const chainLabel = style({
  display: "flex",
  alignItems: "center",
  gap: 4,
  minHeight: 28,
  selectors: { [mobile]: { minHeight: 36 } },
});

export const chainIcon = style({
  width: 28,
  height: 28,
  borderRadius: "50%",
  marginRight: 8,
  selectors: { [mobile]: { width: 36, height: 36 } },
});

export const status = style({
  display: "flex",
  alignItems: "center",
  marginRight: 6,
  fontSize: 14,
  fontWeight: 500,
  lineHeight: "normal",
});

export const connectedDot = style({
  width: 8,
  height: 8,
  boxSizing: "border-box",
  flexShrink: 0,
  marginLeft: 8,
  background: vars.color.statusSuccess,
  border: `1px solid ${vars.color.tabBorder}`,
  borderRadius: "50%",
});

export const pendingDot = style({
  width: 8,
  height: 8,
  flexShrink: 0,
  marginLeft: 8,
  background: vars.color.statusWarning,
  borderRadius: "50%",
});

export const errorDot = style([
  pendingDot,
  { background: vars.color.textDanger },
]);

export const separator = style({
  height: 1,
  flexShrink: 0,
  margin: "0 8px",
  background: vars.color.tabBorder,
});

export const disconnectRow = style({ color: vars.color.textDanger });

export const mobileSeparator = style([
  separator,
  { display: "none", selectors: { [mobile]: { display: "block" } } },
]);
