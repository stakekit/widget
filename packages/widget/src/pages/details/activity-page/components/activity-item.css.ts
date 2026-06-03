import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../styles/theme/atoms.css";

export const listItem = style([
  atoms({ gap: "1" }),
  { flexDirection: "column" },
]);

export const iconCircle = style([
  atoms({ background: "background" }),
  {
    width: "40px",
    height: "40px",
    minWidth: "40px",
    borderRadius: "50%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
]);

export const infoColumn = style({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  minWidth: 0,
});

export const titleText = style([
  atoms({ fontWeight: "medium" }),
  { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
]);

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
});

export const amountPositive = style([
  atoms({ color: "positionsRewardRate", fontWeight: "medium" }),
  { whiteSpace: "nowrap" },
]);

export const amountNeutral = style([
  atoms({ color: "text", fontWeight: "medium" }),
  { whiteSpace: "nowrap" },
]);

export const timeColumn = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  textAlign: "end",
  flexShrink: 0,
});

export const noWrap = style({ whiteSpace: "nowrap" });
