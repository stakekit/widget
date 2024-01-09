import { style } from "@vanilla-extract/css";
import { atoms, vars } from "../../../styles";

export const selectItemText = style({
  color: vars.color.tokenSelect,
  fontWeight: vars.fontWeight.tokenSelect,
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

export const apyVariable = style({
  cursor: "pointer",
  position: "absolute",
  top: -5,
  right: -10,
});

export const apyVariableTooltip = style({
  cursor: "default",
  visibility: "hidden",
  backgroundColor: vars.color.tooltipBackground,
  textAlign: "center",
  borderRadius: "6px",
  padding: "5px 5px",
  position: "absolute",
  zIndex: "1",
  bottom: "150%",
  width: "160px",
  left: "50%",
  marginLeft: "-80px",

  selectors: {
    [`${apyVariable}:hover &`]: {
      visibility: "visible",
    },
    [`${apyVariable}:focus &`]: {
      visibility: "visible",
    },
  },
  "::after": {
    content: "",
    position: "absolute",
    top: "100%",
    left: "50%",
    marginLeft: "-5px",
    borderWidth: "5px",
    borderStyle: "solid",
    borderColor: "black transparent transparent transparent",
  },
});

export const validatorPill = style([
  atoms({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "backgroundMuted",
    borderRadius: "full",
  }),
  { padding: "5px 8px" },
]);

export const addValidatorButton = style([
  atoms({
    borderRadius: "full",
    background: "backgroundMuted",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }),
  { height: "100%", aspectRatio: "1 / 1" },
]);

export const addValidatorContainer = style([
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
