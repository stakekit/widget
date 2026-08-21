import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

export const divider = recipe({
  base: atoms({
    height: "px",
    width: "full",
  }),
  variants: {
    variant: {
      default: atoms({ background: "backgroundMuted" }),
      utila: atoms({ background: "tabBorder" }),
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const verticalDivider = recipe({
  base: {
    alignSelf: "stretch",
    width: "1px",
    marginTop: "-18px",
  },
  variants: {
    variant: {
      default: [
        atoms({
          background: "backgroundMuted",
        }),
      ],
      utila: [
        atoms({
          background: "tabBorder",
        }),
      ],
    },
  },
  defaultVariants: {
    variant: "default",
  },
});
