import { style } from "@vanilla-extract/css";

export const container = style({
  "::-webkit-scrollbar": {
    height: 0,
    width: 0,
  },
  maxHeight: "max(65vh, 500px)",
  overflow: "auto",
});

export const relativeWrapper = style({
  width: "100%",
  position: "relative",
});

export const absoluteWrapper = style({
  position: "absolute",
  width: "100%",
  top: 0,
  left: 0,
});
