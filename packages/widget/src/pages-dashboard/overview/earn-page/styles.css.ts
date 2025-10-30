import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

export const container = style([
  atoms({
    gap: "6",
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
      default: {},
      utila: atoms({ color: "__internal__utila__primary__blue__" }),
      porto: atoms({ color: "__internal__porto__primary__purple__" }),
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
      default: {},
      utila: atoms({ marginBottom: "4" }),
      porto: atoms({ marginBottom: "4" }),
    },
  },
});

export const selectValidatorSectionContainer = recipe({
  variants: {
    variant: {
      default: {},
      utila: atoms({
        marginTop: "6",
        marginBottom: "4",
      }),
      porto: atoms({
        marginTop: "6",
        marginBottom: "4",
      }),
    },
  },
});

export const nameOrAddressText = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
