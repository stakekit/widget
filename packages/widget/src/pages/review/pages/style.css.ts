import { vars } from "@sk-widget/styles/theme/contract.css";
import { style } from "@vanilla-extract/css";

export const feeStyles = style({
  textAlign: "right",
});

export const pointerStyles = style({
  cursor: "pointer",
  textDecoration: "underline",
  color: vars.color.text,
});

export const headingStyles = style({
  lineHeight: 1.25,
});
