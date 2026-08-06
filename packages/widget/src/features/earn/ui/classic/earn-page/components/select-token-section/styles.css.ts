import { recipe } from "@vanilla-extract/recipes";

export const selectTokenTitle = recipe({
  variants: {
    variant: {
      default: {
        fontSize: "14px",
      },
      utila: {
        fontSize: "14px",
      },
      porto: {
        fontSize: "14px",
      },
    },
  },
});
