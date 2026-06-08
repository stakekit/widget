import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";
import { OUTLET_PADDING } from "../../common/components/styles.css";

export const container = style({ minHeight: "400px" });

export const actionTabs = style({
  alignSelf: "flex-start",
  background: vars.color.backgroundMuted,
  borderRadius: "9999px",
  display: "inline-flex",
  gap: "4px",
  padding: "4px",
});

export const actionTab = recipe({
  base: {
    alignItems: "center",
    border: 0,
    borderRadius: "9999px",
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    padding: "8px 18px",
    transition: "background 0.15s ease, box-shadow 0.15s ease",
  },
  variants: {
    state: {
      active: {
        background: vars.color.background,
        boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)",
      },
      inactive: {
        background: "transparent",
      },
    },
  },
});

export const actionTabText = style({
  fontSize: "13px",
  whiteSpace: "nowrap",
});

export const infoContainer = style({
  boxSizing: "border-box",
  maxHeight: "620px",
  minWidth: 0,
  overflowY: "auto",
  scrollbarGutter: "stable",
  marginRight: `calc(-1 * ${OUTLET_PADDING})`,
  paddingRight: OUTLET_PADDING,
});

export const metricGrid = style({
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
});

export const metricCard = recipe({
  base: [
    atoms({
      borderRadius: "base",
      px: "3",
      py: "3",
    }),
    {
      minWidth: 0,
    },
  ],
  variants: {
    tone: {
      action: {
        background: "#FEF2F2",
      },
      claim: {
        background: "#F0FDF4",
      },
      default: atoms({
        background: "stakeSectionBackground",
      }),
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export const metricLabelText = style({
  fontSize: "13px",
  lineHeight: "18px",
});

export const metricValueText = recipe({
  base: {
    fontSize: "16px",
    lineHeight: "20px",
  },
  variants: {
    tone: {
      action: { color: "#B91C1C" },
      claim: { color: "#15803D" },
      default: {},
    },
  },
  defaultVariants: {
    tone: "default",
  },
});

export const metricSubValueText = style({
  fontSize: "11px",
  lineHeight: "16px",
});

export const breakdownRow = style([
  atoms({
    alignItems: "flex-start",
    display: "flex",
    gap: "4",
    justifyContent: "space-between",
    py: "2",
  }),
  {
    borderBottom: `1px solid ${vars.color.backgroundMuted}`,
    minWidth: 0,
  },
]);

export const breakdownAmounts = style({
  alignItems: "flex-end",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
});

export const breakdownValue = style({
  maxWidth: "100%",
  minWidth: 0,
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const breakdownSubValue = style({
  fontSize: "11px",
  lineHeight: "16px",
  textAlign: "right",
});
