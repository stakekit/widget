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
      default: atoms({
        background: "smallLightButtonBackground",
        borderRadius: "base",
      }),
      utila: [
        { borderRadius: "4px" },
        atoms({ background: "smallLightButtonBackground" }),
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
      default: atoms({
        color: "smallLightButtonColor",
        fontWeight: "normal",
      }),
      utila: [
        atoms({ color: "smallLightButtonColor" }),
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
