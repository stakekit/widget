import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";

export const validatorVirtuosoContainer = style([atoms({ marginTop: "2" })]);

const breakWord = style({ wordBreak: "break-all" });

export const modalItemNameContainer = style([
  atoms({ marginRight: "2" }),
  breakWord,
  {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
]);

export const inactiveContainer = style([
  atoms({
    borderRadius: "base",
    background: "positionsActionRequiredBackground",
  }),
  { padding: "2px 6px" },
]);
