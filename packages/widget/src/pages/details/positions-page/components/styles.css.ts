import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../styles/theme/atoms.css";

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
