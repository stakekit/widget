import { vars } from "../../theme";
import { connectKitTheme } from "../connect-kit";
import { radiiContract } from "./contract";

export const radii: typeof radiiContract = {
  baseContract: {
    none: "0",
    sm: "2px",
    base: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    "2xl": "16px",
    "3xl": "24px",
    full: "9999px",
    half: "50%",
    widgetBorderRadius: "0",
    primaryButton: "16px",
    secondaryButton: "16px",
  },

  connectKit: {
    ...connectKitTheme.lightMode.radii,
    actionButton: vars.borderRadius.baseContract["2xl"],
  },
};
