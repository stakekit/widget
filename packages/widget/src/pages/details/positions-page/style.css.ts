import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";

export const listItemContainer = recipe({
  base: [atoms({ borderRadius: "base" }), { padding: "2px 4px" }],

  variants: {
    type: {
      claim: atoms({ background: "positionsClaimRewardsBackground" }),
      actionRequired: atoms({
        background: "positionsActionRequiredBackground",
      }),
      pending: atoms({ background: "positionsPendingBackground" }),
    },
    variant: {
      default: {},
      utila: {},
      finery: {},
      porto: {},
    },
  },
  compoundVariants: [
    {
      variants: {
        variant: "utila",
      },
      style: {
        background: "none",
      },
    },
    {
      variants: {
        variant: "porto",
      },
      style: {
        background: "none",
      },
    },
  ],

  defaultVariants: {
    variant: "default",
  },
});

export const badgeText = recipe({
  variants: {
    type: {
      regular: atoms({ color: "text" }),
      white: atoms({ color: "white" }),
    },
  },
});

export const utilaBadgeText = recipe({
  base: [
    {
      fontSize: "12px",
    },
  ],
  variants: {
    type: {
      regular: atoms({ color: "text" }),
      success: atoms({ color: "__internal__utila__badge__text__success__" }),
      error: atoms({ color: "__internal__utila__badge__text__error__" }),
    },
  },
});

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
});

export const container = style({
  minHeight: "300px",
});
