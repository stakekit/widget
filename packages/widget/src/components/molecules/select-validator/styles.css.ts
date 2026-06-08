import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const validatorVirtuosoContainer = style([atoms({ marginTop: "2" })]);

export const emptyState = style([
  atoms({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    px: "4",
  }),
  {
    minHeight: "180px",
  },
]);

const breakWord = style({ wordBreak: "break-all" });

export const modalItemNameContainer = style([
  atoms({ marginRight: "2" }),
  breakWord,
  {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
]);

export const inactiveContainer = style([
  atoms({
    borderRadius: "base",
    background: "positionsActionRequiredBackground",
  }),
  { padding: "2px 6px" },
]);

export const noWrap = style({ whiteSpace: "nowrap" });

export const rewardRateText = style([
  atoms({ color: "positionsRewardRate", fontWeight: "bold" }),
  { whiteSpace: "nowrap" },
]);

export const rewardRateLabel = style({
  textTransform: "uppercase",
  whiteSpace: "nowrap",
});

export const groupLabel = style({
  textTransform: "uppercase",
  letterSpacing: "0.06em",
});

export const addressParent = style({});

export const addressHover = style({
  selectors: {
    [`${addressParent}:hover &`]: { color: vars.color.text },
  },
});
