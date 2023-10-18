import { style } from "@vanilla-extract/css";
import { atoms, vars } from "../../../styles";

export const selectItemText = style({
  color: vars.color.tokenSelect,
  fontWeight: vars.fontWeight.tokenSelect,
});

export const triggerStyles = style({
  width: "100%",
});

export const validatorVirtuosoContainer = style([atoms({ marginTop: "2" })]);

export const dotContainer = style({
  width: "16px",
  height: "16px",
  textAlign: "center",
});

export const apyYield = style([
  {
    fontSize: vars.fontSize["3xl"],
    fontWeight: vars.fontWeight.normal,
  },
]);

export const breakWord = style({ wordBreak: "break-all" });

export const modalItemNameContainer = style([
  atoms({ marginRight: "2" }),
  breakWord,
  {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
]);
