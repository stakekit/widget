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
      default: atoms({ background: "background" }),
      utila: atoms({ background: "__internal__utila__grey__one__" }),
      finery: [
        atoms({ background: "__internal__finery__grey__two__" }),
        {
          boxShadow: "0px 15px 30px 0px #0000000D",
          ":hover": {
            background: vars.color.tokenSelectHoverBackground,
          },
        },
      ],
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
    },
  },
});
