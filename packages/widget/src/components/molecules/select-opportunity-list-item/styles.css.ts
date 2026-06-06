import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";

export const selectItemText = style([
  atoms({
    color: "tokenSelect",
    fontWeight: "tokenSelect",
  }),
]);

export const rewardRateText = style([
  atoms({ color: "positionsRewardRate", fontWeight: "medium" }),
  { whiteSpace: "nowrap" },
]);
