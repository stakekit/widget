import { style } from "@vanilla-extract/css";
import { vars } from "../../../styles";

export const feeStyles = style({
  textAlign: "right",
});

export const pointerStyles = style({
  cursor: "pointer",
  textDecoration: "underline",
  color: vars.color.text,
});

export const headingStyles = style({ lineHeight: 1.25 });
