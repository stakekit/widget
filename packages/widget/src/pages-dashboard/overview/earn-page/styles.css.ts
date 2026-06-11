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

export const changeButton = recipe({
  base: [{ cursor: "pointer" }],
  variants: {
    variant: {
      default: atoms({ color: "accent" }),
      utila: atoms({ color: "accent" }),
      porto: atoms({ color: "accent" }),
      finery: {},
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const selectTokenTitleContainer = recipe({
  variants: {
    variant: {
      default: atoms({ marginBottom: "4" }),
      utila: atoms({ marginBottom: "4" }),
      porto: atoms({ marginBottom: "4" }),
    },
  },
});

export const nameOrAddressText = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
