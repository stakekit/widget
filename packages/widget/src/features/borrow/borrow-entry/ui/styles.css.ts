import { globalStyle, style } from "@vanilla-extract/css";
import { atoms } from "../../../../shared/styles/theme/atoms.css";
import { vars } from "../../../../shared/styles/theme/contract.css";
import { OUTLET_PADDING } from "../../../widget-shell/dashboard/components/styles.css";

const pane = style({
  minWidth: 0,
});

export const formPane = style([
  pane,
  atoms({
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: "4",
  }),
  {
    maxWidth: "380px",
  },
]);

export const detailsPaneWrapper = style([
  pane,
  {
    alignSelf: "stretch",
    minHeight: "620px",
    position: "relative",
  },
]);

export const detailsScroll = style({
  bottom: 0,
  boxSizing: "border-box",
  left: 0,
  marginRight: `calc(-1 * ${OUTLET_PADDING})`,
  overflowY: "auto",
  paddingRight: OUTLET_PADDING,
  position: "absolute",
  right: 0,
  scrollbarGutter: "stable",
  top: 0,
});

export const assetSelectorList = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  maxHeight: "min(520px, calc(100vh - 220px))",
  overflowY: "auto",
  paddingBottom: "8px",
  paddingTop: "8px",
  scrollbarGutter: "stable",
});

export const assetSelectorSectionTitle = style({
  padding: "8px 5px",
});

export const assetSelectorGroup = style({
  display: "flex",
  flexDirection: "column",
  gap: "8px",
});

export const assetSelectorRow = style({
  alignItems: "center",
  background: vars.color.tokenSelectBackground,
  border: "1px solid transparent",
  borderRadius: vars.borderRadius.baseContract.xl,
  boxSizing: "border-box",
  color: vars.color.text,
  cursor: "pointer",
  display: "flex",
  font: "inherit",
  gap: "10px",
  minHeight: "64px",
  minWidth: 0,
  padding: "12px",
  textAlign: "left",
  width: "100%",
  ":hover": {
    background: vars.color.tokenSelectHoverBackground,
  },
});

export const assetSelectorRowSelected = style({
  background: vars.color.tokenSelectHoverBackground,
});

export const assetSelectorMarketRow = style({
  paddingLeft: "48px",
});

export const assetSelectorChevron = style({
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  transition: "transform 150ms ease",
});

export const assetSelectorChevronExpanded = style({
  transform: "rotate(180deg)",
});

export const assetSelectorText = style({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  gap: "6px",
  minWidth: 0,
});

export const assetSelectorLabel = style([
  atoms({
    color: "tokenSelect",
    fontWeight: "tokenSelect",
  }),
  {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
]);

export const assetSelectorMeta = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const assetSelectorRate = style({
  alignItems: "flex-end",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  gap: "6px",
  minWidth: "72px",
});

export const assetSelectorEmpty = style([
  atoms({
    borderRadius: "xl",
    px: "3",
    py: "4",
  }),
  {
    background: vars.color.tokenSelectBackground,
    textAlign: "center",
  },
]);

export const detailCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "1",
    px: "4",
    py: "4",
  }),
]);

globalStyle(`${detailCard} > *:last-child`, {
  borderBottom: 0,
});

export const infoNote = style([
  atoms({
    background: "stakeSectionBackground",
    borderColor: "backgroundMuted",
    borderRadius: "base",
    px: "3",
    py: "3",
  }),
  {
    borderStyle: "solid",
    borderWidth: "1px",
  },
]);

export const infoNoteError = style({
  borderColor: vars.color.textDanger,
});

export const detailsHeader = style({
  alignItems: "center",
  display: "flex",
  gap: "12px",
  minWidth: 0,
});

export const metricGrid = style({
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
});

export const metricCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "base",
    px: "3",
    py: "3",
  }),
]);
