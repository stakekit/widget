import { style } from "@vanilla-extract/css";
import { atoms } from "../../../shared/styles/theme/atoms.css";

export const animationContainer = style([
  atoms({ gap: "2" }),
  {
    display: "flex",
    justifyContent: "center",
  },
]);
