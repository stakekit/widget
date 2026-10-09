import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { vars } from "../../../../shared/styles/theme/contract.css";
import {
  breakpoints,
  minMediaQuery,
} from "../../../../shared/styles/tokens/breakpoints";

const fadeIn = keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const slideUp = keyframes({
  from: { transform: "translateY(20%)" },
  to: { transform: "translateY(0)" },
});

export const mobile = "[data-wallet-dialog-mobile] &";

export const overlay = style({
  position: "fixed",
  inset: 0,
  zIndex: 20,
  background: vars.color.modalOverlayBackground,
  animation: `${fadeIn} 150ms ease`,
});

// Same geometry as SelectModal: a bottom sheet below the tablet breakpoint,
// a centred dialog above it.
export const positioner = style({
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100dvh",
  zIndex: 20,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  pointerEvents: "none",
  "@media": { [minMediaQuery("tablet")]: { alignItems: "center" } },
});

export const content = style({
  boxSizing: "border-box",
  width: "100%",
  maxWidth: `${breakpoints.tablet}px`,
  maxHeight: "100dvh",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  pointerEvents: "auto",
  background: vars.color.modalBodyBackground,
  borderTopLeftRadius: vars.borderRadius.baseContract["2xl"],
  borderTopRightRadius: vars.borderRadius.baseContract["2xl"],
  color: vars.color.text,
  fontFamily: vars.font.body,
  fontSize: 16,
  lineHeight: "normal",
  outline: "none",
  animation: `${slideUp} 350ms cubic-bezier(.15,1.15,0.6,1), ${fadeIn} 150ms ease`,
  "@media": {
    [minMediaQuery("tablet")]: {
      width: 368,
      borderBottomLeftRadius: vars.borderRadius.baseContract["2xl"],
      borderBottomRightRadius: vars.borderRadius.baseContract["2xl"],
    },
    "(prefers-reduced-motion: reduce)": { animation: "none" },
  },
});

export const closeButton = style({
  boxSizing: "border-box",
  padding: 0,
  width: 28,
  height: 28,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: `1px solid ${vars.color.tabBorder}`,
  borderRadius: "50%",
  background: vars.color.backgroundMuted,
  color: vars.color.textMuted,
  cursor: "pointer",
  transition: "125ms ease",
  ":hover": { transform: "scale(1.1)" },
  ":active": { transform: "scale(.95)" },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: 2,
  },
  selectors: { [mobile]: { width: 30, height: 30, borderWidth: 0 } },
});

export const heading = style({
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  lineHeight: "24px",
  selectors: { [mobile]: { fontSize: 20, lineHeight: "28px" } },
});

export const menuButton = style({
  appearance: "none",
  boxSizing: "border-box",
  display: "block",
  flexShrink: 0,
  width: "100%",
  padding: 6,
  border: 0,
  borderRadius: vars.borderRadius.baseContract.xl,
  background: "transparent",
  color: vars.color.text,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "125ms ease",
  ":hover": { background: vars.color.backgroundMuted },
  ":active": { transform: "scale(.95)" },
  ":focus-visible": {
    outline: `2px solid ${vars.color.accent}`,
    outlineOffset: 0,
  },
  selectors: {
    [mobile]: { padding: 8 },
    '&[aria-current="true"]': {
      background: vars.color.primaryButtonBackground,
      border: `1px solid ${vars.color.primaryButtonBackground}`,
      boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.24)",
      color: vars.color.primaryButtonColor,
      cursor: "default",
      transform: "none",
    },
  },
});

export const desktopClose = style({
  display: "flex",
  selectors: { [mobile]: { display: "none" } },
});

export const mobileClose = style({
  display: "none",
  selectors: { [mobile]: { display: "flex" } },
});

// The connected-wallet summary buttons that open the account and chain modals.
export const walletSummaryTrigger = recipe({
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

export const walletSummaryTitle = style([
  atoms({ fontWeight: "modalHeading" }),
]);
