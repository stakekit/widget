import { style } from "@vanilla-extract/css";

export const headerProviderText = style({
  fontSize: "13px",
  lineHeight: "18px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const titleText = style({
  fontSize: "16px",
  lineHeight: "120%",
});

export const headerProviderLabelText = style({
  fontSize: "13px",
  lineHeight: "18px",
});

export const headerBadgeRow = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 6px",
  minWidth: 0,
});

export const headerBadgeSeparator = style({
  flexShrink: 0,
  fontSize: "13px",
  lineHeight: "18px",
});
