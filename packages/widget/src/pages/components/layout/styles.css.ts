import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";

export const headerContainer = style([atoms({ px: "4" })]);

export const absoluteContainer = style({
  top: "0",
  position: "absolute",
  width: "100%",
});
