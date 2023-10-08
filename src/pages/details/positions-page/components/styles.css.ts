import { style } from "@vanilla-extract/css";
import { vars } from "../../../../styles";

export const selectItemText = style({
  color: vars.color.tokenSelect,
  fontWeight: vars.fontWeight.tokenSelect,
});

export const triggerStyles = style({
  width: "100%",
});

export const hideScrollbar = style({
  "::-webkit-scrollbar": {
    height: 0,
    width: 0,
  },
});

export const tab = style({
  cursor: "pointer",
  userSelect: "none",
});

export const dotContainer = style({
  width: "16px",
  height: "16px",
  textAlign: "center",
});

export const validatorAddress = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
