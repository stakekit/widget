import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";

export const headerContainer = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  alignItems: "start",
});

export const posistionDetailsInfoContainer = style([
  atoms({
    flex: 1,
    gap: "8",
    width: "0",
  }),
  {
    maxWidth: "600px",
  },
]);
