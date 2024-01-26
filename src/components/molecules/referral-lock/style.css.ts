import { style } from "@vanilla-extract/css";
import { atoms, vars } from "../../../styles";

export const inputContainer = style([
  {
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: vars.color.backgroundMuted,
  },
  atoms({
    borderRadius: "sm",
    fontSize: "4xl",
    fontWeight: "normal",
    color: "white",
    paddingBottom: "1",
  }),
]);

export const input = style([
  {
    all: "unset",
    width: "40px",
    textAlign: "center",
    cursor: "pointer",
    pointerEvents: "all",
    outline: "none",

    ":disabled": {
      cursor: "not-allowed",
      pointerEvents: "none",
      outline: "none",
    },
  },
]);
