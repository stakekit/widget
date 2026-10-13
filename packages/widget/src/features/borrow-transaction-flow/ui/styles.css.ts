import { style } from "@vanilla-extract/css";
import { atoms } from "../../../shared/styles/theme/atoms.css";
import { vars } from "../../../shared/styles/theme/contract.css";

export const executionError = style([
  atoms({
    background: "stakeSectionBackground",
    borderColor: "backgroundMuted",
    borderRadius: "xl",
    px: "3",
    py: "3",
  }),
  {
    borderColor: vars.color.textDanger,
    borderStyle: "solid",
    borderWidth: "1px",
  },
]);

export const flowBackButton = style({
  alignItems: "center",
  alignSelf: "flex-start",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  display: "flex",
  justifyContent: "flex-start",
  padding: 0,
});

export const formCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "3",
    px: "4",
    py: "4",
  }),
]);

export const transactionList = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "1",
    px: "4",
    py: "3",
  }),
]);

export const transactionRow = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "3",
    justifyContent: "space-between",
    py: "2",
  }),
  {
    background: "transparent",
    border: 0,
    borderTop: `1px solid ${vars.color.tabBorder}`,
    cursor: "pointer",
    width: "100%",
    selectors: {
      "&:hover": { opacity: 0.8 },
    },
  },
]);

export const successBadge = style([
  atoms({
    alignItems: "center",
    alignSelf: "center",
    borderRadius: "full",
    display: "flex",
    justifyContent: "center",
  }),
  {
    background: `color-mix(in oklab, ${vars.color.statusSuccess} 14%, transparent)`,
    height: "56px",
    width: "56px",
  },
]);

export const explorerLink = style([
  atoms({
    alignItems: "center",
    alignSelf: "center",
    display: "flex",
    gap: "1",
  }),
  {
    background: "transparent",
    border: 0,
    cursor: "pointer",
    padding: 0,
    selectors: {
      "&:hover": { opacity: 0.8 },
    },
  },
]);
