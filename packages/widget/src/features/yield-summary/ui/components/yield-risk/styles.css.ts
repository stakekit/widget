import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../../../../shared/styles/theme/contract.css";

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
    // A rating scale reads by solid hue, so badges stay filled; the fills follow
    // the theme's status tokens.
    tone: {
      positive: { background: vars.color.statusSuccess },
      warning: { background: vars.color.statusWarning },
      danger: { background: vars.color.textDanger },
      neutral: { background: vars.color.textMuted },
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
      positive: { color: vars.color.white },
      // Amber needs dark ink in every theme for contrast.
      warning: {
        color: `color-mix(in oklab, ${vars.color.statusWarning} 20%, black)`,
      },
      danger: { color: vars.color.white },
      neutral: { color: vars.color.white },
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
