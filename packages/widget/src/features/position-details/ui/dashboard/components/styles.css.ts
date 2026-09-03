import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../../../../shared/styles/theme/contract.css";

export const container = style({ minHeight: "400px" });

export const actionTabs = style({
  alignSelf: "flex-start",
  background: vars.color.backgroundMuted,
  borderRadius: "9999px",
  display: "inline-flex",
  gap: "4px",
  padding: "4px",
});

export const actionTab = recipe({
  base: {
    alignItems: "center",
    border: 0,
    borderRadius: "9999px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    padding: "8px 18px",
    transition: "background 0.15s ease, box-shadow 0.15s ease",
  },
  variants: {
    state: {
      active: {
        background: vars.color.background,
        boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)",
      },
      inactive: { background: "transparent" },
    },
  },
});

export const actionTabText = style({
  fontSize: "13px",
  whiteSpace: "nowrap",
});
