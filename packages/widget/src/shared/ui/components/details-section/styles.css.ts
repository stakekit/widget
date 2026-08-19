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
    borderBottom: `1px solid ${vars.color.backgroundMuted}`,
  },
]);

globalStyle(`${detailRow}:last-child`, {
  borderBottom: "none",
});

export const addressBox = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "base",
    display: "flex",
    justifyContent: "space-between",
    gap: "2",
    px: "3",
    py: "2",
  }),
  { minWidth: 0 },
]);

export const addressValue = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "1",
    minWidth: "0",
  }),
]);

export const detailRowLabel = style({ lineHeight: "20px" });

export const valueText = style({
  lineHeight: "20px",
  minWidth: 0,
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
