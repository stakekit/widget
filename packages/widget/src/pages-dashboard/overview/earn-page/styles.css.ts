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

export const changeButton = style([
  atoms({
    color: "__internal__utila__primaryBlue",
  }),
  { cursor: "pointer" },
]);

export const selectTokenTitleContainer = recipe({
  variants: {
    variant: {
      default: {},
      utila: atoms({ marginBottom: "4" }),
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
    },
  },
});
