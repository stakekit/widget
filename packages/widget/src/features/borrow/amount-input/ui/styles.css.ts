import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { vars } from "../../../../shared/styles/theme/contract.css";

export const amountCard = style([
  atoms({
    background: "transparent",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "3",
    px: "4",
    py: "4",
  }),
  {
    borderColor: vars.color.backgroundMuted,
    borderStyle: "solid",
    borderWidth: "1px",
    minHeight: 116,
  },
]);

export const amountCardHighlighted = style({
  borderColor: vars.color.tokenSelectBorder,
});

export const amountCardHeader = style({
  alignItems: "center",
  display: "grid",
  gap: "12px",
  gridTemplateColumns: "minmax(0, 1fr) auto",
});

export const amountCardFooter = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "4px 10px",
  justifyContent: "space-between",
  minWidth: 0,
});

export const amountBalanceGroup = style({
  alignItems: "center",
  display: "flex",
  flexGrow: 1,
  gap: "8px",
  justifyContent: "flex-end",
  minWidth: 0,
  textAlign: "right",
});

export const amountTokenButton = style([
  atoms({
    alignItems: "center",
    borderRadius: "2xl",
    display: "flex",
    gap: "2",
    px: "3",
    py: "2",
  }),
  {
    border: 0,
    font: "inherit",
    maxWidth: "min(240px, 100%)",
    minWidth: 0,
  },
]);

export const amountTokenButtonSelectable = style({
  cursor: "pointer",
});

export const amountTokenButtonText = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const amountTokenButtonCaret = style({
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  height: "12px",
  justifyContent: "center",
  width: "12px",
});
