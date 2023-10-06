import { style } from "@vanilla-extract/css";
import { vars } from "../../styles";

export const spanStyle = style({
  wordBreak: "break-all",
});

export const feeStyles = style({
  textAlign: "right",
});

export const pointer = style({
  cursor: "pointer",
  textDecoration: "underline",
  color: vars.color.text,
});
