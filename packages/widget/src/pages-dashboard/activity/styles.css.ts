import { atoms } from "@sk-widget/styles/theme/atoms.css";
import { style } from "@vanilla-extract/css";

export const container = style({
  minHeight: "300px",
});

export const listItemWrapper = style([
  atoms({
    display: "flex",
    gap: "3",
    paddingLeft: "1",
  }),
]);

export const activityDetailsContainer = style([
  atoms({ background: "dashboardDetailsSectionBackground" }),
  {
    borderRadius: "16px",
    minHeight: "400px",
    display: "flex",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
]);
