import { style } from "@vanilla-extract/css";
import { vars } from "../../../../styles";

export const selectItemText = style({
  color: vars.color.tokenSelect,
  fontWeight: vars.fontWeight.tokenSelect,
});

export const validatorAddress = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const importValidatorContainer = style({
  minHeight: "50px",
});

export const noWrap = style({ whiteSpace: "nowrap" });

export const listItem = style({
  alignItems: "flex-start",
});
