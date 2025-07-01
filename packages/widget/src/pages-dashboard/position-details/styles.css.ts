import { style } from "@vanilla-extract/css";
import { atoms } from "../../styles/theme/atoms.css";

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
