import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { vars } from "@sk-widget/styles/theme/contract.css";
import { style } from "@vanilla-extract/css";

export const trigger = style([
  atoms({
    background: "dropdownBackground",
    px: "3",
    py: "2",
  }),
  { borderRadius: "6px" },
]);

export const dropdownContent = style([
  { borderRadius: "6px", overflow: "hidden" },
  atoms({
    background: "dropdownBackground",
  }),
]);

export const dropdownGroup = style([
  {
    display: "flex",
    flexDirection: "column",
  },
]);

export const dropdownItem = style([
  {
    outline: "none",
    userSelect: "none",
    cursor: "pointer",
    overflow: "hidden",
  },
  atoms({
    px: "5",
    py: "2",
    display: "flex",
    alignItems: "center",
  }),
  {
    selectors: {
      '&[data-state="checked"]': {
        background: vars.color.tokenSelectHoverBackground,
      },
    },
    ":hover": {
      background: vars.color.tokenSelectHoverBackground,
    },
  },
]);

export const separator = style([
  { height: "1px" },
  atoms({ background: "background" }),
]);
