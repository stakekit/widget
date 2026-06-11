import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

export const divider = recipe({
  base: atoms({
    height: "px",
    width: "full",
  }),
  variants: {
    variant: {
      default: atoms({ background: "tabBorder" }),
      utila: atoms({ background: "tabBorder" }),
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
