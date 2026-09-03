import { style } from "@vanilla-extract/css";
import { atoms } from "../../../shared/styles/theme/atoms.css";
import { vars } from "../../../shared/styles/theme/contract.css";

export const executionError = style([
  atoms({
    background: "stakeSectionBackground",
    borderColor: "backgroundMuted",
    borderRadius: "base",
    px: "3",
    py: "3",
  }),
  {
    borderColor: vars.color.textDanger,
    borderStyle: "solid",
    borderWidth: "1px",
  },
]);

export const flowBackButton = style({
  alignItems: "center",
  alignSelf: "flex-start",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  display: "flex",
  justifyContent: "flex-start",
  padding: 0,
});

export const formCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "3",
    px: "4",
    py: "4",
  }),
]);
