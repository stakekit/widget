import { globalStyle, style } from "@vanilla-extract/css";
import { atoms } from "../../../shared/styles/theme/atoms.css";
import { vars } from "../../../shared/styles/theme/contract.css";
import { OUTLET_PADDING } from "../../widget-shell/dashboard/components/styles.css";

export const pane = style({
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

export const amountCardInvalid = style({
  borderColor: vars.color.textDanger,
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

export const mutedPanel = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "2",
    px: "4",
    py: "4",
  }),
]);

export const marketList = style([
  atoms({
    display: "flex",
    flexDirection: "column",
    gap: "2",
  }),
]);

export const marketButton = style([
  atoms({
    alignItems: "center",
    background: "background",
    borderColor: "backgroundMuted",
    borderRadius: "xl",
    display: "flex",
    gap: "3",
    px: "3",
    py: "3",
  }),
  {
    borderStyle: "solid",
    borderWidth: "1px",
    cursor: "pointer",
    font: "inherit",
    textAlign: "left",
    width: "100%",
  },
]);

export const marketButtonSelected = style({
  borderColor: vars.color.text,
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

export const badge = style([
  atoms({
    borderRadius: "base",
    px: "2",
  }),
  {
    background: `color-mix(in srgb, ${vars.color.text} 8%, transparent)`,
  },
]);

export const errorText = style({
  color: vars.color.textDanger,
});

export const executionStep = style({
  minHeight: 52,
});

export const executionError = style([infoNote, infoNoteError]);

export const flowBackButton = style({
  alignItems: "center",
  alignSelf: "flex-start",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  display: "flex",
  justifyContent: "flex-start",
  padding: 0,
});

export const ltvGauge = style([
  atoms({
    display: "flex",
    flexDirection: "column",
    gap: "2",
  }),
]);

export const ltvGaugeTrack = style({
  background: `linear-gradient(90deg, #25a56a 0%, #f6b500 52%, ${vars.color.textDanger} 100%)`,
  borderRadius: vars.borderRadius.baseContract.full,
  height: "10px",
  overflow: "hidden",
  position: "relative",
});

export const ltvGaugeMarker = style({
  background: vars.color.text,
  border: `2px solid ${vars.color.background}`,
  borderRadius: vars.borderRadius.baseContract.full,
  height: "14px",
  position: "absolute",
  top: "50%",
  transform: "translate(-50%, -50%)",
  width: "14px",
});

export const ltvGaugeThreshold = style({
  background: vars.color.background,
  height: "100%",
  position: "absolute",
  top: 0,
  transform: "translateX(-50%)",
  width: "2px",
});

export const ltvGaugeLabels = style({
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
});

export const healthValue = style({
  color: "#25a56a",
});

export const healthValueWarning = style({
  color: "#f6b500",
});

export const healthValueDanger = style({
  color: vars.color.textDanger,
});

export const collateralList = style([
  atoms({
    display: "flex",
    flexDirection: "column",
    gap: "2",
  }),
]);

export const collateralListButton = style({
  alignItems: "center",
  background: "transparent",
  border: 0,
  color: vars.color.text,
  cursor: "pointer",
  display: "flex",
  font: "inherit",
  gap: "8px",
  padding: 0,
  textAlign: "left",
  width: "100%",
});

export const collateralRow = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "base",
    px: "3",
    py: "3",
  }),
  {
    alignItems: "center",
    display: "grid",
    gap: "12px",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto) auto",
  },
]);

export const switchButton = style({
  alignItems: "center",
  background: vars.color.backgroundMuted,
  border: 0,
  borderRadius: vars.borderRadius.baseContract.full,
  cursor: "pointer",
  display: "inline-flex",
  height: "20px",
  padding: "2px",
  width: "36px",
});

export const switchButtonChecked = style({
  background: "#25a56a",
});

export const switchThumb = style({
  background: vars.color.text,
  borderRadius: vars.borderRadius.baseContract.full,
  height: "16px",
  transform: "translateX(0)",
  transition: "transform 150ms ease",
  width: "16px",
});

export const switchThumbChecked = style({
  transform: "translateX(16px)",
});

export const formCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "3",
    px: "4",
    py: "4",
  }),
]);

export const checkboxRow = style({
  alignItems: "center",
  display: "flex",
  gap: "10px",
  justifyContent: "space-between",
});

export const checkbox = style({
  height: "18px",
  width: "18px",
});

export const actionCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "xl",
    display: "flex",
    gap: "3",
    px: "4",
    py: "4",
  }),
  {
    alignItems: "center",
    justifyContent: "space-between",
  },
]);
