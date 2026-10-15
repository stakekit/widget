import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../../shared/styles/theme/atoms.css";

export const container = style([
  atoms({
    gap: "4",
  }),
  {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
]);
