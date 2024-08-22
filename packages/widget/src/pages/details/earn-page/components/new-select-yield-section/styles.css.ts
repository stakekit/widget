import { atoms } from "@sk-widget/styles";
import { style } from "@vanilla-extract/css";

export const breakWord = style({ wordBreak: "break-all" });

export const selectContainer = style([
  atoms({
    marginRight: "2",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "stretch",
    marginTop: "3",
    flexWrap: "wrap",
  }),
  { rowGap: "5px", gap: "5px" },
]);
