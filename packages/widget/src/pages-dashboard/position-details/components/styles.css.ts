import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const container = style({ minHeight: "400px" });

export const infoContainer = style({
  boxSizing: "border-box",
  maxHeight: "620px",
  minWidth: 0,
  overflowY: "auto",
  paddingRight: vars.space["3"],
  scrollbarGutter: "stable",
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
