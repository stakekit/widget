import { style } from "@vanilla-extract/css";
import { vars } from "../../../styles/theme/contract.css";

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
    background: "#FEF1CF",
    color: "#9A4F0E",
  },
]);

export const headerAutoBadge = style([
  headerBadgeBase,
  {
    background: "#E8F9EF",
    color: "#15803D",
  },
]);

export const headerBadgeText = style({
  fontSize: "11px",
  whiteSpace: "nowrap",
});
