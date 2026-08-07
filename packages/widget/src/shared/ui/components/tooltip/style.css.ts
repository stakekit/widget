import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const tooltipContent = atoms({
  borderRadius: "md",
  px: "2",
  py: "2",
  background: "tooltipBackground",
  zIndex: "modal",
});

export const triggerWrapper = atoms({
  display: "flex",
});

export const tooltipArrow = style([
  {
    fill: vars.color.tooltipBackground,
  },
]);
