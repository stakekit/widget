import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";

export const tabContainer = style({
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  position: "relative",
});

export const tab = style([
  atoms({ px: "4", py: "3" }),
  { cursor: "pointer", userSelect: "none" },
]);

export const tabBorder = style([
  atoms({
    background: "tabBorder",
    borderRadius: "full",
    position: "absolute",
  }),
  {
    bottom: 0,
    height: "2.5px",
    width: "100%",
    transition: "all .2s ease",
  },
]);

export const activeTabBorder = style({
  transform: "translateX(0)",
});

export const leftTabBorder = style({
  transform: "translateX(101%)",
});

export const rightTabBorder = style({
  transform: "translateX(-101%)",
});

export const rewardsBadge = style([
  atoms({
    width: "4",
    height: "4",
    borderRadius: "full",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    background: "positionsActionRequiredBackground",
  }),
  {
    zIndex: 1,
    top: "-12px",
    right: "-15px",
  },
]);

export const divider = style({
  position: "absolute",
  width: "100%",
  bottom: 0,
});
