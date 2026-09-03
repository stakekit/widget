import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const riskRatingBadge = recipe({
  base: {
    alignItems: "center",
    borderRadius: "6px",
    display: "inline-flex",
    flexShrink: 0,
    justifyContent: "center",
    whiteSpace: "nowrap",
  },
  variants: {
    size: {
      compact: {
        height: "18px",
        minWidth: "24px",
        padding: "1px 7px",
      },
      default: {
        height: "32px",
        minWidth: "44px",
        padding: "4px 12px",
      },
    },
    tone: {
      positive: { background: "#35C96F" },
      warning: { background: "#F6B500" },
      danger: { background: "#FF3B1F" },
      neutral: { background: "#6E6E6E" },
    },
  },
  defaultVariants: {
    size: "compact",
    tone: "neutral",
  },
});

export const riskRatingBadgeText = recipe({
  base: {
    fontWeight: 700,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  variants: {
    size: {
      compact: {
        fontSize: "12px",
      },
      default: {
        fontSize: "16px",
      },
    },
    tone: {
      positive: { color: "#FFFFFF" },
      warning: { color: "#1F1F1F" },
      danger: { color: "#FFFFFF" },
      neutral: { color: "#FFFFFF" },
    },
  },
  defaultVariants: {
    size: "compact",
    tone: "neutral",
  },
});

export const riskSummaryContainer = style({
  minHeight: "64px",
});

export const riskSummaryActions = style({
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  gap: "12px",
});

export const riskInfoButton = style({
  all: "unset",
  alignItems: "center",
  cursor: "help",
  display: "flex",
  justifyContent: "center",
});
