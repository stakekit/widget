import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { DASHBOARD_OUTLET_PADDING } from "../../../styles/tokens/layout";

export const dashboardDetailsScroll = style({
  bottom: 0,
  boxSizing: "border-box",
  left: 0,
  marginRight: `calc(-1 * ${DASHBOARD_OUTLET_PADDING})`,
  overflowY: "auto",
  paddingRight: DASHBOARD_OUTLET_PADDING,
  position: "absolute",
  right: 0,
  scrollbarGutter: "stable",
  top: 0,
});

export const dashboardMetricGrid = style({
  display: "grid",
  gap: "8px",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
});

export const dashboardMetricCard = style([
  atoms({
    background: "stakeSectionBackground",
    borderRadius: "base",
    px: "3",
    py: "3",
  }),
]);
