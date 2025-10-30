import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../styles/theme/atoms.css";

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

export const activityDetailsContainer = recipe({
  base: [
    atoms({ background: "dashboardDetailsSectionBackground" }),
    {
      borderRadius: "16px",
      minHeight: "400px",
      display: "flex",
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
  ],
  variants: {
    variant: {
      default: {},
      utila: {},
      porto: {
        borderRadius: "8px",
      },
      finery: {},
    },
  },
});
