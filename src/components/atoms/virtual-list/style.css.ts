import { globalStyle, style } from "@vanilla-extract/css";

export const hideScrollbar = style({
  "::-webkit-scrollbar": {
    height: 0,
    width: 0,
  },
});

export const virtualContainer = style({});

globalStyle(`${virtualContainer} > div > div`, {
  paddingBottom: "5px !important",
});

export const container = style({
  overflowY: "scroll",
});
