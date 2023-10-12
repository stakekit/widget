import { globalStyle, style } from "@vanilla-extract/css";

export const hideScrollbar = style({
  "::-webkit-scrollbar": {
    height: 0,
    width: 0,
  },
});

export const renderAllItems = style({});

globalStyle(`${renderAllItems} > div`, {
  position: "static !important" as "static",
});

globalStyle(`${renderAllItems} > div > div`, {
  minHeight: "1px",
  paddingTop: "0 !important",
});
