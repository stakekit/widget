import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../styles/theme/atoms.css";

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
