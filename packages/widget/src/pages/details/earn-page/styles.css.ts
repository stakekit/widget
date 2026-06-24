import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const selectItemText = style({
  color: vars.color.tokenSelect,
  fontWeight: vars.fontWeight.tokenSelect,
});

export const validatorVirtuosoContainer = style([atoms({ marginTop: "2" })]);

export const apyYield = style([
  {
    color: vars.color.text,
    fontSize: vars.fontSize["3xl"],
    fontWeight: vars.fontWeight.normal,
  },
]);

export const overflowEllipsis = style({
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const selectorSummaryCard = style([
  atoms({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: "xl",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "backgroundMuted",
    background: "background",
    gap: "3",
    padding: "3",
    width: "full",
  }),
  {
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,
  },
]);

export const selectorSummaryContent = style([
  atoms({
    display: "flex",
    alignItems: "center",
    gap: "3",
    flex: 1,
    minWidth: "0",
  }),
]);

export const selectorSummaryText = style([
  atoms({
    display: "flex",
    flexDirection: "column",
    gap: "1",
    flex: 1,
    minWidth: "0",
  }),
]);

export const selectorSummaryHeader = style([
  atoms({
    display: "flex",
    alignItems: "center",
    gap: "2",
  }),
  {
    minWidth: 0,
  },
]);

export const selectorSummaryMeta = style([
  atoms({
    display: "flex",
    alignItems: "center",
    gap: "1",
    flexWrap: "wrap",
  }),
  {
    minWidth: 0,
  },
]);

export const selectorSummaryWebsite = style([
  atoms({
    color: "textMuted",
  }),
  {
    display: "block",
    maxWidth: "100%",
    minWidth: 0,
    overflowWrap: "anywhere",
    textDecoration: "none",

    ":hover": {
      textDecoration: "underline",
    },
  },
]);

export const selectorSummaryChangeButton = style([
  atoms({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "backgroundMuted",
    borderRadius: "full",
    gap: "1",
    flexShrink: 0,
  }),
  {
    boxSizing: "border-box",
    minHeight: 42,
    padding: "0 14px",
  },
]);

export const selectorSummaryBadge = style({
  alignItems: "center",
  background: `color-mix(in srgb, ${vars.color.positionsRewardRate} 18%, transparent)`,
  border: `1px solid color-mix(in srgb, ${vars.color.positionsRewardRate} 38%, transparent)`,
  borderRadius: vars.borderRadius.baseContract.full,
  color: vars.color.positionsRewardRate,
  display: "inline-flex",
  fontSize: vars.fontSize.sm,
  fontWeight: vars.fontWeight.bold,
  lineHeight: 1,
  padding: "3px 8px",
  whiteSpace: "nowrap",
});

export const selectorSummaryActive = style({
  color: "#137333",
  whiteSpace: "nowrap",
});

export const addValidatorContainer = style([
  atoms({
    marginRight: "0",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "stretch",
    marginTop: "3",
    flexWrap: "wrap",
    width: "full",
  }),
  { boxSizing: "border-box", rowGap: "5px", gap: "5px", maxWidth: "100%" },
]);

export const validatorChipsContainer = style([
  atoms({
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: "2",
    marginTop: "3",
    width: "full",
  }),
  {
    boxSizing: "border-box",
    maxWidth: "100%",
    minWidth: 0,
  },
]);

export const validatorChip = style([
  atoms({
    alignItems: "center",
    background: "backgroundMuted",
    borderRadius: "2xl",
    display: "flex",
    gap: "1",
    px: "2",
    py: "1",
  }),
  {
    boxSizing: "border-box",
    maxWidth: "100%",
    minHeight: 34,
    minWidth: 0,
  },
]);

export const validatorChipName = style({
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const validatorChipRemoveButton = style([
  atoms({
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
  }),
  {
    background: "transparent",
    border: 0,
    color: vars.color.textMuted,
    cursor: "pointer",
    font: "inherit",
    padding: 0,
  },
]);

export const validatorChipAddButton = style([
  atoms({
    alignItems: "center",
    background: "backgroundMuted",
    borderRadius: "2xl",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
  }),
  {
    border: 0,
    boxSizing: "border-box",
    cursor: "pointer",
    font: "inherit",
    height: 34,
    width: 34,
  },
]);
