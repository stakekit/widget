import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../../../../shared/styles/theme/contract.css";

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
