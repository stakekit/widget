import { vars } from "@sk-widget/styles";
import { style } from "@vanilla-extract/css";

export const tooltipContent = style({
  borderRadius: vars.borderRadius.baseContract.md,
  padding: vars.space[2],
  backgroundColor: vars.color.tooltipBackground,
});
