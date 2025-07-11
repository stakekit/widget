import { keyframes, style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";

const fadeIn = keyframes({
  "0%": { opacity: 0 },
  "100%": { opacity: 1 },
});

export const overlay = style([
  atoms({
    background: "modalOverlayBackground",
    zIndex: "overlay",
  }),
  {
    position: "fixed",
    inset: 0,
    animation: `${fadeIn} 150ms ease`,
    willChange: "opacity",
  },
]);

export const content = style([
  atoms({ background: "modalBodyBackground", zIndex: "modal" }),
  {
    borderRadius: "8px",
    boxShadow: "0px 15px 30px 0px #0000000D",
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "650px",
    maxHeight: "85vh",
    overflow: "hidden",
  },
]);

export const container = style({
  padding: "24px",
  maxHeight: "80vh",
  overflow: "auto",
});

export const contentContainer = style({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
});

export const sectionContainer = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  marginBottom: "8px",
});

export const closeButton = style({
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "4px",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  ":hover": {
    backgroundColor: "rgba(100, 23, 23, 0.1)",
  },
});

export const termsText = style([
  atoms({ color: "textMuted" }),
  {
    fontSize: "12px",
    lineHeight: "145%",
  },
]);
