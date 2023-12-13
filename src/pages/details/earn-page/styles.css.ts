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
