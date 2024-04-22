import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";
import { recipe } from "@vanilla-extract/recipes";
import { minMediaQuery } from "../../../styles/tokens/breakpoints";

export const listItemContainer = recipe({
  base: [atoms({ borderRadius: "base" }), { padding: "2px 4px" }],

  variants: {
    type: {
      claim: atoms({ background: "positionsClaimRewardsBackground" }),
      actionRequired: atoms({
        background: "positionsActionRequiredBackground",
      }),
    },
  },
});

export const positionDetailsContainer = style([
  atoms({ gap: { mobile: "1", tablet: "2" } }),
  {
    display: "flex",
    alignItems: "flex-start",
    flexDirection: "column-reverse",
    justifyContent: "center",

    "@media": {
      [minMediaQuery("tablet")]: {
        alignItems: "center",
        flexDirection: "row",
      },
    },
  },
]);

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
  width: "100%",
});

export const container = style({
  minHeight: "300px",
});
