import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../../styles/theme/atoms.css";
import { vars } from "../../../../../styles/theme/contract.css";

export const selectOpportunityButton = recipe({
  base: [
    atoms({
      display: "flex",
      justifyContent: "center",
      alignItems: "center",

      borderRadius: "2xl",
      px: "2",
      py: "1",
    }),
  ],
  variants: {
    variant: {
      default: atoms({ background: "tokenSelectBackground" }),
      utila: atoms({ background: "tokenSelectBackground" }),
      finery: [
        atoms({ background: "tokenSelectBackground" }),
        {
          boxShadow: "0px 15px 30px 0px #0000000D",
          ":hover": {
            background: vars.color.tokenSelectHoverBackground,
          },
        },
      ],
      porto: atoms({ background: "tokenSelectBackground" }),
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export const selectYieldRewardsText = recipe({
  variants: {
    variant: {
      default: {},
      utila: {},
      finery: {
        color: vars.color.text,
      },
      porto: {},
    },
  },
});

export const selectYieldSection = recipe({
  base: atoms({
    borderRadius: "xl",
  }),
  variants: {
    variant: {
      default: {},
      porto: {
        borderRadius: "8px",
      },
    },
  },
});

export const viaProviderImage = style({
  minWidth: 0,
});
