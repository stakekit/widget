import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const container = style({
  maxHeight: "620px",
  overflowY: "auto",
});

export const earnDetailsWrapper = style({
  alignSelf: "flex-start",
});

export const headerProviderText = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const titleText = style({
  fontSize: "20px",
  lineHeight: "120%",
});

export const headerBadgeRow = style({
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  minWidth: 0,
});

export const headerBadge = style([
  atoms({
    borderRadius: "base",
    px: "2",
  }),
  {
    background: "#FEF3C7",
    color: "#92400E",
  },
]);

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
    alignItems: "center",
    background: "background",
    borderRadius: "base",
    display: "flex",
    gap: "3",
    px: "4",
    py: "3",
  }),
  {
    border: `1px solid ${vars.color.backgroundMuted}`,
    cursor: "pointer",
    font: "inherit",
    minWidth: 0,
    textAlign: "left",
    width: "100%",
  },
]);

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
    flexShrink: 0,
  },
]);

export const providerMetaText = style({
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const providerStatusText = style({
  color: "#15803D",
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

export const valueText = style({
  minWidth: 0,
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
