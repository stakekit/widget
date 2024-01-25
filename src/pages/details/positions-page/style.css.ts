import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";
import { recipe } from "@vanilla-extract/recipes";

export const listItemContainer = recipe({
  base: [atoms({ borderRadius: "base" }), { padding: "2px 6px" }],

  variants: {
    type: {
      claim: atoms({ background: "positionsClaimRewardsBackground" }),
      actionRequired: atoms({
        background: "positionsActionRequiredBackground",
      }),
    },
  },
});

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
  width: "100%",
});

export const container = style({
  minHeight: "300px",
});
