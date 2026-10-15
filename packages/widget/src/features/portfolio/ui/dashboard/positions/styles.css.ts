import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const container = style({
  minHeight: "300px",
  height: "100%",
});

export const sectionHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
});

export const sectionTitle = style({
  textTransform: "uppercase",
  letterSpacing: "0.04em",
});

export const positionsTitle = recipe({
  variants: {
    variant: {
      default: {
        fontSize: "16px",
      },
      utila: {
        fontSize: "16px",
      },
      finery: {},
      porto: {
        fontSize: "16px",
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
