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
    accent: utilaPalette.primaryBlue,
    summaryItemBackground: utilaPalette.greyOne,
    backgroundMuted: utilaPalette.greyOne,
    stakeSectionBackground: utilaPalette.greyOne,
    tokenSelectBackground: utilaPalette.greyOne,
    tokenSelectBorder: utilaPalette.selectTokenBorder,
    dashboardDetailsSectionBackground: utilaPalette.greyOne,
    warningBoxBackground: utilaPalette.warningBackground,

    tabBorder: utilaPalette.border,

    primaryButtonBackground: utilaPalette.primaryBlue,
    primaryButtonColor: vars.color.white,
    smallLightButtonColor: utilaPalette.maxButtonText,
    smallLightButtonBackground: utilaPalette.maxButtonBackground,

    summaryLabelStakedBackground: "#F6F0FF",
    summaryLabelStakedColor: "#5A36C0",
    summaryLabelApyBackground: "#F7ECFA",
    summaryLabelApyColor: "#CA6CBD",
    summaryLabelAvailableBackground: "#EEF7F3",
    summaryLabelAvailableColor: "#327C5F",
  },
};
