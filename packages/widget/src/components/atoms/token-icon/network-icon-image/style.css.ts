import { style } from "@vanilla-extract/css";

const baseContainer = {
  position: "absolute",
  bottom: -2,
  right: -2,
  borderRadius: "50%",
  padding: "3px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

export const logoContainer = style({
  ...baseContainer,
  backgroundColor: "#ffffff",
  boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.06)",
});

export const fallbackContainer = style({
  ...baseContainer,
  backgroundColor: "#9ca3af",
});

export const logoImage = style({
  maxWidth: "100%",
  height: "auto",
});
