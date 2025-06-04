import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";

export const inlineText = style([
  atoms({
    fontSize: "xs",
    color: "textMuted",
  }),
  { display: "inline" },
]);
