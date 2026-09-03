import { style } from "@vanilla-extract/css";

export const unstakeSignImageStyle = style({
  height: "320px",
  width: "320px",
});

export const unstakeSignContainer = style({
  paddingLeft: "25px",
  paddingRight: "25px",
});

import { vars } from "../../../../../shared/styles/theme/contract.css";

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
