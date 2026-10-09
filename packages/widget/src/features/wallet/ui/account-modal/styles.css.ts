import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { vars } from "../../../../shared/styles/theme/contract.css";
import { mobile } from "../wallet-dialog/styles.css";

export const container = recipe({
  base: {
    cursor: "pointer",
    transition: "0.125s ease",
    ":hover": {
      transform: "scale(1.025)",
    },
    ":active": {
      transform: "scale(0.95)",
    },
  },
  variants: {
    variant: {
      default: {},
      finery: {
        background: vars.color.summaryItemBackground,
        boxShadow: "0px 15px 30px 0px #0000000D",
      },
      porto: {
        background: vars.color.summaryItemBackground,
      },
      utila: {},
    },
  },
});

export const titleStyle = style([atoms({ fontWeight: "modalHeading" })]);

export const triggerAvatar = style({ marginRight: 8 });

export const profile = style({
  padding: 16,
  overflowY: "auto",
  background: vars.color.modalBodyBackground,
  minHeight: 0,
});

export const profileDetails = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  margin: 8,
  textAlign: "center",
  selectors: { [mobile]: { gap: 16 } },
});

export const close = style({
  position: "absolute",
  right: 16,
  top: 16,
});

export const profileAvatar = style({
  width: 74,
  height: 74,
  fontSize: 41,
  selectors: {
    [mobile]: { width: 82, height: 82, fontSize: 45, marginTop: 24 },
  },
});

export const accountOption = style({ width: "auto", textAlign: "center" });

export const actions = style({
  display: "flex",
  flexDirection: "row",
  gap: 8,
  margin: 2,
  marginTop: 16,
});

export const action = style({
  boxSizing: "border-box",
  flex: 1,
  display: "flex",
  width: "100%",
  padding: 8,
  border: 0,
  borderRadius: vars.borderRadius.baseContract.xl,
  background: vars.color.tokenSelectBackground,
  boxShadow: "0px 2px 6px rgba(37, 41, 46, 0.04)",
  color: vars.color.text,
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 600,
  lineHeight: "18px",
  transition: "125ms ease",
  ":hover": {
    background: vars.color.tokenSelectHoverBackground,
    transform: "scale(1.025)",
  },
  ":active": { transform: "scale(.95)" },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: 2,
  },
  selectors: {
    [mobile]: { padding: 6, fontSize: 12, lineHeight: "16px" },
  },
});

export const actionContent = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 1,
  paddingTop: 2,
  width: "100%",
});

export const actionIcon = style({
  height: "max-content",
  lineHeight: "normal",
});
