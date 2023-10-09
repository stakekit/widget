import { style } from "@vanilla-extract/css";
import { vars } from "../../styles";

export const pointer = style({
  cursor: "pointer",
  textDecoration: "underline",
  color: vars.color.text,
});
