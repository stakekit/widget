import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { utilaPalette } from "../../../styles/theme/variant-overrides/palettes";

export const divider = recipe({
  base: atoms({
    height: "px",
    width: "full",
  }),
  variants: {
    variant: {
      default: atoms({ background: "backgroundMuted" }),
      utila: { background: utilaPalette.tabPageDivider },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
