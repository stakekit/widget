import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";

export const tabContainer = style({
  display: "flex",
  flexDirection: "column",
  position: "relative",
});

export const tab = style([
  atoms({ px: "4", py: "3" }),
  { cursor: "pointer", userSelect: "none" },
]);

export const rewardsDot = style({
  position: "absolute",
  right: "-7px",
});

export const divider = style({
  position: "absolute",
  width: "100%",
  bottom: 0,
});

export const tabBorder = style([
  atoms({
    background: "tabBorder",
    borderRadius: "full",
    position: "absolute",
  }),
  {
    bottom: 0,
    left: 0,
    right: 0,
    height: "2.5px",
  },
]);
