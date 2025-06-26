import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { recipe } from "@vanilla-extract/recipes";

export const selectOpportunityButton = recipe({
  base: [
    atoms({
      display: "flex",
      justifyContent: "center",
      alignItems: "center",

      borderRadius: "2xl",
      px: "2",
      py: "1",
    }),
  ],
  variants: {
    variant: {
      default: atoms({ background: "background" }),
      utila: atoms({ background: "__internal__utila__greyOne" }),
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
