import { style } from "@vanilla-extract/css";
import { atoms, vars } from "../../../styles";

export const inputsContainer = style([
  atoms({
    px: "3",
    py: "7",
    gap: "1",
    background: "black",
    borderRadius: "xl",
    alignItems: "center",
    justifyContent: "center",
  }),
  {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gridTemplateRows: "1fr",
  },
]);

export const inputContainer = style([
  {
    borderBottomWidth: "3px",
    borderBottomStyle: "solid",
    borderBottomColor: vars.color.backgroundMuted,
    minWidth: 0,
    display: "flex",
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
    minWidth: "0",
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
