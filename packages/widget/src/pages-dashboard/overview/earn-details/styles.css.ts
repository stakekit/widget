import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";
import { OUTLET_PADDING } from "../../common/components/styles.css";

export const container = style({
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

export const earnDetailsWrapper = style({
  alignSelf: "stretch",
  minHeight: "620px",
  minWidth: 0,
  position: "relative",
});

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

const headerBadgeBase = style({
  alignItems: "center",
  borderRadius: vars.borderRadius.baseContract.md,
  display: "inline-flex",
  flexShrink: 0,
  padding: "2px 8px",
});

export const headerBadge = style([
  headerBadgeBase,
  {
    background: "#FEF1CF",
    color: "#9A4F0E",
  },
]);

export const headerAutoBadge = style([
  headerBadgeBase,
  {
    background: "#E8F9EF",
    color: "#15803D",
  },
]);

export const headerBadgeText = style({
  fontSize: "11px",
  whiteSpace: "nowrap",
});

export const autoBadge = style([
  atoms({
    borderRadius: "base",
    px: "2",
  }),
  {
    background: "#DCFCE7",
    color: "#15803D",
  },
]);

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
  {
    minWidth: 0,
  },
]);

export const providerCard = style([
  atoms({
    alignItems: "stretch",
    background: "background",
    borderRadius: "xl",
    display: "flex",
    flexDirection: "column",
    gap: "2",
    px: "4",
    py: "4",
  }),
  {
    border: `1px solid ${vars.color.backgroundMuted}`,
    boxSizing: "border-box",
    font: "inherit",
    maxWidth: "100%",
    minWidth: 0,
    textAlign: "left",
    width: "100%",
  },
]);

export const providerCardMainRow = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "3",
  }),
  {
    minWidth: 0,
    width: "100%",
  },
]);

export const providerCardContent = style([
  atoms({
    display: "flex",
    flex: 1,
    flexDirection: "column",
    gap: "1",
    minWidth: "0",
  }),
]);

export const providerCardHeader = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "2",
  }),
  {
    minWidth: 0,
  },
]);

export const providerNameText = style({
  fontSize: "13px",
  lineHeight: "20px",
  minWidth: 0,
  overflowWrap: "anywhere",
});

export const providerChangeButton = style([
  atoms({
    alignItems: "center",
    background: "stakeSectionBackground",
    borderRadius: "2xl",
    display: "flex",
    gap: "1",
    px: "3",
    py: "2",
  }),
  {
    border: 0,
    boxSizing: "border-box",
    cursor: "pointer",
    flexShrink: 0,
    font: "inherit",
    // minHeight: "42px",
  },
]);

export const providerMetaText = style({
  display: "flex",
  flexWrap: "wrap",
  fontSize: "13px",
  gap: "0 8px",
  lineHeight: "18px",
  overflowWrap: "anywhere",
});

export const providerWebsiteText = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "1",
  }),
  {
    color: vars.color.textMuted,
    fontSize: "13px",
    lineHeight: "18px",
    overflowWrap: "anywhere",
    textDecoration: "none",
  },
]);

export const externalLinkIcon = style({
  flexShrink: 0,
});

export const providerStatusText = style({
  color: "#15803D",
});

export const metricLabelText = style({
  fontSize: "13px",
  lineHeight: "18px",
});

export const metricValueText = style({
  fontSize: "16px",
  lineHeight: "20px",
});

export const metricSubValueText = style({
  fontSize: "11px",
  lineHeight: "16px",
});

export const sectionDivider = style([
  atoms({
    background: "backgroundMuted",
  }),
  {
    height: "1px",
    width: "100%",
  },
]);

export const rangeButton = recipe({
  base: [
    atoms({
      borderRadius: "base",
      px: "2",
      py: "1",
    }),
    {
      border: 0,
      cursor: "pointer",
      font: "inherit",
    },
  ],
  variants: {
    active: {
      true: atoms({ background: "stakeSectionBackground" }),
      false: atoms({ background: "transparent" }),
    },
  },
});

export const chartContainer = style({
  height: "150px",
  minWidth: 0,
  position: "relative",
  width: "100%",
});

const chartOverlayFadeIn = keyframes({
  "0%": { opacity: 0 },
  "100%": { opacity: 1 },
});

export const chartLoadingOverlay = style([
  atoms({
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
  }),
  {
    animation: `${chartOverlayFadeIn} 150ms ease`,
    backdropFilter: "blur(2px)",
    backgroundColor: `color-mix(in srgb, ${vars.color.background} 72%, transparent)`,
    inset: 0,
    position: "absolute",
    willChange: "opacity",
    zIndex: 1,
  },
]);

globalStyle(
  `${chartContainer}:is(:focus, :focus-visible, :focus-within), ${chartContainer} *:is(:focus, :focus-visible, :focus-within)`,
  {
    outline: "none",
  }
);

export const emptyChartContainer = style([
  atoms({
    alignItems: "center",
    display: "flex",
    justifyContent: "center",
  }),
  {
    height: "150px",
  },
]);

export const axisLabel = style({
  fill: vars.color.textMuted,
  fontSize: "11px",
  fontWeight: 400,
});

export const detailRow = style([
  atoms({
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    gap: "4",
    py: "2",
  }),
  {
    borderBottom: `1px solid ${vars.color.backgroundMuted}`,
  },
]);

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
  {
    minWidth: 0,
  },
]);

export const addressValue = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "1",
    minWidth: "0",
  }),
]);

export const valueText = style({
  minWidth: 0,
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const networkValue = style([
  atoms({
    alignItems: "center",
    display: "flex",
    gap: "1",
    justifyContent: "flex-end",
    minWidth: "0",
  }),
]);

export const integrationDocsLink = style([
  atoms({
    alignItems: "center",
    display: "inline-flex",
    gap: "1",
    marginTop: "1",
  }),
  {
    color: vars.color.textMuted,
    fontSize: "13px",
    lineHeight: "18px",
    textDecoration: "none",
    width: "fit-content",
  },
]);
