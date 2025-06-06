import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const priceTxt = style({
  flexGrow: 999,
});

export const selectTokenSection = recipe({
  variants: {
    variant: {
      default: atoms({
        background: "stakeSectionBackground",
      }),
      utila: {
        background: "transparent",
      },
    },
    state: {
      default: {},
      danger: {},
    },
  },
  compoundVariants: [
    {
      variants: {
        variant: "default",
      },
      style: {
        borderColor: "transparent",
      },
    },
    {
      variants: {
        state: "danger",
        variant: "utila",
      },
      style: atoms({
        borderColor: "textDanger",
      }),
    },
    {
      variants: {
        state: "default",
        variant: "utila",
      },
      style: atoms({
        borderColor: "__internal__utila__selectTokenBorder",
      }),
    },
  ],
});

export const selectTokenTitle = recipe({
  variants: {
    variant: {
      default: {},
      utila: {
        fontSize: "16px",
      },
    },
  },
});
