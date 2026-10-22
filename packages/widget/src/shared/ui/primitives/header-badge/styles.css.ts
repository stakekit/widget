import { style } from "@vanilla-extract/css";
import { vars } from "../../../styles/theme/contract.css";
import { statusInk, statusTint } from "../../../styles/theme/status-tint";

const headerBadgeBase = style({
  alignItems: "center",
  borderRadius: vars.borderRadius.baseContract.md,
  display: "inline-flex",
  flexShrink: 0,
  padding: "2px 8px",
});

export const headerBadge = style([
  headerBadgeBase,
  {
    background: statusTint(vars.color.statusWarning),
    color: statusInk(vars.color.statusWarning),
  },
]);

export const headerAutoBadge = style([
  headerBadgeBase,
  {
    background: statusTint(vars.color.statusSuccess),
    color: statusInk(vars.color.statusSuccess),
  },
]);

export const headerBadgeText = style({
  fontSize: "11px",
  whiteSpace: "nowrap",
});
