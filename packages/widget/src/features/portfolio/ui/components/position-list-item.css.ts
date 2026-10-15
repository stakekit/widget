import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../shared/styles/theme/atoms.css";

export const noWrap = style({ whiteSpace: "nowrap" });

export const rewardRateText = style([
  atoms({ color: "positionsRewardRate", fontWeight: "medium" }),
  { whiteSpace: "nowrap" },
]);

export const positionName = style([
  atoms({ fontWeight: "medium" }),
  { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
]);

export const positionInfoColumn = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minWidth: 0,
});

export const listItem = style([
  atoms({ gap: "1" }),
  { flexDirection: "column", paddingLeft: "10px", paddingRight: "10px" },
]);

export const positionBadge = recipe({
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

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
});
