import { style } from "@vanilla-extract/css";

export const triggerContainer = style([
  { cursor: "pointer", userSelect: "none" },
]);

export const caretContainer = style({
  transition: "transform 0.2s ease",
});

export const rotate180deg = style({
  transform: "rotate(180deg)",
});
