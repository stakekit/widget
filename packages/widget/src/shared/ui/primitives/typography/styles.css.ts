import type { RecipeVariants } from "@vanilla-extract/recipes";
import { recipe } from "@vanilla-extract/recipes";
import { Record as ERecord } from "effect";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";
import { minMediaQuery } from "../../../styles/tokens/breakpoints";

const fontWeightVariants = {
  normal: atoms({ fontWeight: "normal" }),
  medium: atoms({ fontWeight: "medium" }),
  semibold: atoms({ fontWeight: "semibold" }),
  bold: atoms({ fontWeight: "bold" }),
  extrabold: atoms({ fontWeight: "extrabold" }),
};

const responsiveFontSize = (sizes: {
  readonly mobile: { readonly fontSize: string };
  readonly tablet: { readonly fontSize: string };
}) => ({
  fontSize: sizes.mobile.fontSize,
  "@media": {
    [minMediaQuery("tablet")]: { fontSize: sizes.tablet.fontSize },
  },
});

export const heading = recipe({
  base: atoms({ color: "text" }),

  variants: {
    level: ERecord.map(vars.heading, responsiveFontSize),
    weight: fontWeightVariants,
  },

  defaultVariants: {
    weight: "normal",
  },
});

export type HeadingVariants = RecipeVariants<typeof heading>;

export const textStyles = recipe({
  variants: {
    weight: fontWeightVariants,
    type: {
      base: {},
      accent: atoms({ color: "accent" }),
      regular: atoms({ color: "text" }),
      muted: atoms({ color: "textMuted" }),
      inverted: atoms({ color: "primary" }),
      white: atoms({ color: "white" }),
      danger: atoms({ color: "textDanger" }),
    },
    size: ERecord.map(vars.text, responsiveFontSize),
  },

  defaultVariants: {
    type: "regular",
    size: "medium",
    weight: "medium",
  },
});

export type TextVariants = RecipeVariants<typeof textStyles>;
