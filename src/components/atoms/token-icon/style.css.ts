import { style } from "@vanilla-extract/css";

export const logoContainer = style({
  position: "absolute",
  bottom: -2,
  right: -2,
  borderRadius: "50%",
  padding: "2px",
  backgroundColor: "rgba(37,37,37, 0.95)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});
