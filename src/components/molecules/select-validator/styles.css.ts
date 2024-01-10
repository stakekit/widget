import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";

export const validatorVirtuosoContainer = style([atoms({ marginTop: "2" })]);

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