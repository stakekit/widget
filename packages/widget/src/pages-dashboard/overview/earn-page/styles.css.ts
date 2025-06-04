import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";

export const container = style([
  atoms({
    gap: "6",
  }),
  {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
]);
