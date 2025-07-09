import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";

export const selectItemText = style([
  atoms({
    color: "tokenSelect",
    fontWeight: "tokenSelect",
  }),
]);
