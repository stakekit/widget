import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../../styles/theme/atoms.css";

export const filtersContainer = style([
  atoms({ display: "flex", alignItems: "center", paddingBottom: "3" }),
  {
    gap: "8px",
    flexWrap: "wrap",
  },
]);

export const filterPill = recipe({
  base: [
    atoms({
      display: "flex",
      alignItems: "center",
      borderWidth: 1,
      borderStyle: "solid",
    }),
    {
      gap: "6px",
      cursor: "pointer",
      userSelect: "none",
      borderRadius: "9999px",
      padding: "6px 12px",
      whiteSpace: "nowrap",
    },
  ],
  variants: {
    state: {
      default: atoms({ background: "transparent", borderColor: "tabBorder" }),
      active: atoms({ background: "text", borderColor: "text" }),
    },
  },
  defaultVariants: {
    state: "default",
  },
});

export const filterCount = recipe({
  base: [
    atoms({ display: "flex", alignItems: "center", justifyContent: "center" }),
    {
      borderRadius: "9999px",
      minWidth: "20px",
      height: "18px",
      padding: "0 6px",
    },
  ],
  variants: {
    state: {
      default: atoms({ background: "backgroundMuted" }),
      active: { background: "rgba(255, 255, 255, 0.2)" },
    },
  },
  defaultVariants: {
    state: "default",
  },
});
