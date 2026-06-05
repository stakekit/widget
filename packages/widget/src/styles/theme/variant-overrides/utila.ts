import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import type { lightTheme } from "../themes";
import { utilaPalette } from "./palettes";

export const utilaThemeOverrides: RecursivePartial<typeof lightTheme> = {
  space: {
    buttonMinHeight: "40px",
  },
  borderRadius: {
    baseContract: {
      primaryButton: "8px",
    },
  },
  color: {
    summaryItemBackground: utilaPalette.greyOne,
    backgroundMuted: utilaPalette.greyOne,
    stakeSectionBackground: utilaPalette.greyOne,
    tokenSelectBackground: utilaPalette.greyOne,
    dashboardDetailsSectionBackground: utilaPalette.greyOne,
    warningBoxBackground: utilaPalette.warningBackground,

    primaryButtonBackground: utilaPalette.primaryBlue,
    primaryButtonColor: vars.color.white,
  },
};
