import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";

export const container = style({
  cursor: "pointer",
  transition: "0.125s ease",
  ":hover": {
    transform: "scale(1.025)",
  },
  ":active": {
    transform: "scale(0.95)",
  },
});

export const titleStyle = style([atoms({ fontWeight: "modalHeading" })]);
