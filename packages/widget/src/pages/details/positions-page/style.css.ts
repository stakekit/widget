import {
  widgetContainerMaxWidth,
  widgetContainerName,
} from "@sk-widget/style.css";
import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { minContainerWidth } from "@sk-widget/styles/tokens/breakpoints";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

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
  },
});

export const positionDetailsContainer = style([
  atoms({ gap: { mobile: "1", tablet: "2" } }),
  {
    display: "flex",

    justifyContent: "center",

    alignItems: "flex-start",
    flexDirection: "column-reverse",

    "@container": {
      [minContainerWidth(widgetContainerName, widgetContainerMaxWidth)]: {
        alignItems: "center",
        flexDirection: "row",
      },
    },
  },
]);

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
});

export const container = style({
  minHeight: "300px",
});
