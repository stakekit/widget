import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { vars } from "@sk-widget/styles/theme/contract.css";
import { style } from "@vanilla-extract/css";

export const initialFontSizeVar = vars.fontSize["3xl"];

const fontStyles = style([
  { fontSize: initialFontSizeVar },
  atoms({ fontWeight: "normal" }),
]);

export const numberInput = style([
  fontStyles,
  atoms({
    flex: 1,
    minWidth: "0",
    color: "text",
  }),
  {
    background: "none",
    border: "none",
    outline: "none",
    paddingLeft: 0,
  },
]);

export const spanStyle = style([
  fontStyles,
  {
    position: "absolute",
    visibility: "hidden",
    right: "100%",
  },
]);

export const container = style({
  display: "flex",
  minWidth: 0,
  flex: 1,
});
