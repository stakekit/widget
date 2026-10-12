import { globalStyle, style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const detailRow = style([
  atoms({
    display: "flex",
    justifyContent: "space-between",
    gap: "4",
    py: "2",
  }),
  {
    alignItems: "baseline",
    borderBottom: `1px solid ${vars.color.tabBorder}`,
  },
]);

globalStyle(`${detailRow}:last-child`, {
  borderBottom: "none",
});

export const detailRowList = style({
  display: "flex",
  flexDirection: "column",
});

export const addressBox = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    justifyContent: "space-between",
    gap: "2",
    px: "3",
    py: "2",
  }),
  { alignItems: "center", minWidth: 0 },
]);

export const addressValue = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "1",
    minWidth: "0",
  }),
]);

export const detailRowLabel = style({
  flexShrink: 0,
  lineHeight: "20px",
  whiteSpace: "nowrap",
});

export const valueText = style({
  lineHeight: "20px",
  minWidth: 0,
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
