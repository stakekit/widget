import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../styles/theme/atoms.css";
import { vars } from "../../../../styles/theme/contract.css";

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

export const overflowText = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const listItem = style([
  atoms({ gap: "1" }),
  { flexDirection: "column", paddingLeft: "10px", paddingRight: "10px" },
]);

export const columnContainer = style([
  atoms({ gap: "1" }),
  {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: "0",
  },
]);
