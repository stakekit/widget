import { recipe } from "@vanilla-extract/recipes";
import { atoms } from "../../../../../shared/styles/theme/atoms.css";

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
