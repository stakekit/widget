import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../../shared/styles/theme/atoms.css";

export const inlineText = style([
  atoms({
    fontSize: "xs",
    color: "textMuted",
  }),
  { display: "inline" },
]);
