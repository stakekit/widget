import { style } from "@vanilla-extract/css";

export const avatarStyle = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: 24,
  height: 24,
  fontSize: 16,
  color: "#000",
  overflow: "hidden",
  position: "relative",
  borderRadius: "50%",
  userSelect: "none",
});
