import { style } from "@vanilla-extract/css";

export const hideScrollbar = style({
  "::-webkit-scrollbar": {
    height: 0,
    width: 0,
  },
});

export const container = style({
  overflowY: "scroll",
});
