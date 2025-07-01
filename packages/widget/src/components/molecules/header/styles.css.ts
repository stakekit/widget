import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";

export const parentButton = style({
  opacity: 0,
  pointerEvents: "none",
  userSelect: "none",
});

export const animationContainer = style([
  atoms({ gap: "2" }),
  {
    display: "flex",
    justifyContent: "center",
  },
]);
