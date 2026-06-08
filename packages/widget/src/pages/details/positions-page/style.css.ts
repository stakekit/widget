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

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
});

export const container = style({
  minHeight: "300px",
});
