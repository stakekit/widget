import { atoms } from "../../../styles";
import { RecipeVariants, recipe } from "@vanilla-extract/recipes";

export const container = recipe({
  variants: {
    size: {
      regular: [atoms({ borderRadius: "xl" })],
      medium: [atoms({ borderRadius: "md" })],
    },
  },
  defaultVariants: {
    size: "regular",
  },
});

export type ContainerVariants = RecipeVariants<typeof container>;
