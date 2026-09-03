import { style } from "@vanilla-extract/css";
import { atoms } from "../../../../../shared/styles/theme/atoms.css";

export const split = style({
  alignItems: "stretch",
  display: "grid",
  gap: "24px",
  gridTemplateColumns: "minmax(320px, 1fr) minmax(400px, 1fr)",
  minWidth: "744px",
  width: "100%",
});

export const feed = style({
  display: "flex",
  minHeight: 0,
  minWidth: 0,
});

export const details = style([
  atoms({ background: "dashboardDetailsSectionBackground" }),
  {
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    minHeight: "520px",
    minWidth: 0,
    overflow: "hidden",
    width: "100%",
  },
]);

/** Match earn/position primary column chrome for Follow Steps / complete. */
export const execution = style({
  display: "flex",
  flexDirection: "column",
  minHeight: "520px",
  minWidth: 0,
  width: "100%",
});
