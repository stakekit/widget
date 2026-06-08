import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";

export const selectItemText = style([
  atoms({
    color: "tokenSelect",
    fontWeight: "tokenSelect",
  }),
]);

export const rewardRateText = style([
  atoms({ color: "positionsRewardRate" }),
  { whiteSpace: "nowrap" },
]);

export const rewardRateLabel = style({
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

export const itemSubtitle = style([
  atoms({ color: "textMuted" }),
  {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
]);
