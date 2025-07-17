import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

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
        atoms({ background: "__internal__utila__max__button__background__" }),
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
      utila: atoms({
        color: "__internal__utila__max__button__text__",
        fontWeight: "normal",
      }),
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
