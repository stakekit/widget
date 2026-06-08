import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

const modalFadeIn = keyframes({
  "0%": { opacity: 0 },
  "100%": { opacity: 1 },
});

const modalScaleIn = keyframes({
  "0%": { opacity: 0, transform: "translateY(12px) scale(0.98)" },
  "100%": { opacity: 1, transform: "translateY(0) scale(1)" },
});

const stateStyles = {
  checking: {
    background: vars.color.backgroundMuted,
    borderColor: "transparent",
  },
  start_kyc: {
    background: "color-mix(in oklab, #5147f3 8%, transparent)",
    borderColor: "#5147f3",
  },
  pending: {
    background: "color-mix(in oklab, #ffc21b 16%, transparent)",
    borderColor: "#ffc21b",
  },
  rejected: {
    background: "color-mix(in oklab, #ff3b1f 10%, transparent)",
    borderColor: "#ff3b1f",
  },
  unknown: {
    background: vars.color.backgroundMuted,
    borderColor: vars.color.textMuted,
  },
} as const;

export const cardStyle = recipe({
  base: [
    atoms({
      borderRadius: "xl",
      borderStyle: "solid",
      borderWidth: 1,
      px: "4",
      py: "4",
      width: "full",
    }),
  ],
  variants: {
    state: stateStyles,
  },
});

export const iconContainerStyle = recipe({
  base: [
    atoms({
      alignItems: "center",
      borderRadius: "full",
      display: "flex",
      justifyContent: "center",
    }),
    {
      height: "24px",
      width: "24px",
      flexShrink: 0,
    },
  ],
  variants: {
    state: {
      start_kyc: { background: "transparent" },
      pending: { background: "transparent" },
      rejected: { background: "transparent" },
      unknown: { background: "transparent" },
    },
  },
});

export const spinnerContainerStyle = style([
  atoms({
    alignItems: "center",
    borderRadius: "full",
    display: "flex",
    justifyContent: "center",
  }),
  {
    height: "24px",
    width: "24px",
    flexShrink: 0,
  },
]);

export const verificationModalContainerStyle = style({
  alignItems: "center",
  bottom: 0,
  display: "flex",
  justifyContent: "center",
  left: 0,
  padding: "16px",
  position: "fixed",
  right: 0,
  top: 0,
  zIndex: 30,
});

export const verificationModalOverlayStyle = style({
  animation: `${modalFadeIn} 150ms ease`,
  background: vars.color.modalOverlayBackground,
  inset: 0,
  position: "absolute",
});

export const verificationModalContentStyle = style([
  atoms({
    background: "modalBodyBackground",
  }),
  {
    animation: `${modalScaleIn} 180ms ease`,
    borderRadius: vars.borderRadius.baseContract["2xl"],
    display: "flex",
    flexDirection: "column",
    height: "min(86vh, 720px)",
    maxHeight: "calc(100vh - 32px)",
    maxWidth: "760px",
    overflow: "hidden",
    position: "relative",
    width: "100%",
    zIndex: 1,
    "@media": {
      "screen and (max-width: 767px)": {
        height: "calc(100vh - 24px)",
        maxHeight: "calc(100vh - 24px)",
      },
    },
  },
]);

export const verificationModalHeaderStyle = style([
  atoms({
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    px: "4",
    py: "3",
  }),
  {
    borderBottom: `1px solid ${vars.color.backgroundMuted}`,
    flexShrink: 0,
  },
]);

export const verificationModalCloseStyle = style([
  atoms({
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
  }),
  {
    height: "32px",
    width: "32px",
  },
]);

export const verificationModalFrameStyle = style({
  background: "#ffffff",
  border: 0,
  flex: 1,
  minHeight: 0,
  width: "100%",
});
