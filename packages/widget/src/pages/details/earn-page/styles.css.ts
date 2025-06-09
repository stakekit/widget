import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { vars } from "@sk-widget/styles/theme/contract.css";
import { style } from "@vanilla-extract/css";

export const selectItemText = style({
  color: vars.color.tokenSelect,
  fontWeight: vars.fontWeight.tokenSelect,
});

export const validatorVirtuosoContainer = style([atoms({ marginTop: "2" })]);

export const apyYield = style([
  {
    color: vars.color.text,
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
