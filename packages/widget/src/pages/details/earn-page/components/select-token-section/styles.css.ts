import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../../styles/theme/atoms.css";
import { vars } from "../../../../../styles/theme/contract.css";

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
      finery: {},
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
        borderColor: "__internal__utila__select__token__border__",
      }),
    },
    {
      variants: {
        state: "danger",
        variant: "finery",
      },
      style: atoms({
        borderColor: "textDanger",
      }),
    },
    {
      variants: {
        state: "default",
        variant: "finery",
      },
      style: atoms({
        borderColor: "__internal__finery__grey__two__",
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

export const selectTokenBalance = recipe({
  variants: {
    variant: {
      default: {},
      utila: {},
      finery: {
        color: vars.color.text,
      },
    },
  },
});

export const bottomBannerBottomRadius = style({
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
});

export const bottomBanner = style([
  atoms({ borderRadius: "xl" }),
  {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    background:
      "linear-gradient(90deg, #4B2921 0%, #723426 25.78%, #994238 59.59%, #7C3C48 100%)",
  },
]);

export const bottomBannerText = style({
  fontSize: "12px",
});
