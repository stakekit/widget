import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { utilaPalette } from "../../../styles/theme/variant-overrides/palettes";

export const container = recipe({
  base: [
    atoms({
      px: "2",
      py: "1",
      marginLeft: "2",
    }),
  ],
  variants: {
    variant: {
      default: atoms({ background: "background", borderRadius: "xl" }),
      utila: [
        { borderRadius: "4px" },
        { background: utilaPalette.maxButtonBackground },
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const text = recipe({
  variants: {
    variant: {
      default: atoms({ color: "text", fontWeight: "semibold" }),
      utila: [
        {
          color: utilaPalette.maxButtonText,
        },
        atoms({
          fontWeight: "normal",
        }),
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
