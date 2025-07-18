import { vars } from "../../theme/contract.css";
import { connectKitTheme } from "../connect-kit";
import type { radiiContract } from "./contract";

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
    smallButton: "7.38px",
  },

  connectKit: {
    ...connectKitTheme.lightMode.radii,
    actionButton: vars.borderRadius.baseContract["2xl"],
  },
};
