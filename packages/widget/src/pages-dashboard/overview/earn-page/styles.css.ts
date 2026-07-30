import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

export const container = style([
  atoms({
    gap: "4",
  }),
  {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
]);

export const selectTokenTitleContainer = recipe({
  variants: {
    variant: {
      default: atoms({ marginBottom: "4" }),
      utila: atoms({ marginBottom: "4" }),
      porto: atoms({ marginBottom: "4" }),
    },
  },
});
