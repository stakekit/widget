import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";

export const headerContainer = style([atoms({ px: "4" })]);

export const absoluteContainer = style({
  top: "0",
  position: "absolute",
  width: "100%",
});
