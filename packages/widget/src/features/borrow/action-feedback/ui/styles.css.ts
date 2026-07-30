import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { vars } from "../../../../shared/styles/theme/contract.css";

export const notice = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "2",
    px: "4",
    py: "4",
  }),
]);

export const errorText = style({
  color: vars.color.textDanger,
});
