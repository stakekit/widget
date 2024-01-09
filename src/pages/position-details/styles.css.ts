import { style } from "@vanilla-extract/css";

export const caretContainer = style({
  transition: "transform 0.2s ease",
});

export const rotate180deg = style({
  transform: "rotate(180deg)",
});

export const providerContainer = style({
  transition: "max-height 0.3s ease",
  overflow: "hidden",
});
