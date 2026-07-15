import type { RecursivePartial } from "../../../types/utils";
import { vars } from "../contract.css";
import type { lightTheme } from "../themes";
import { portoPalette } from "./palettes";

export const portoThemeOverrides: RecursivePartial<typeof lightTheme> = {
  space: {
    buttonMinHeight: "40px",
  },
  borderRadius: {
    baseContract: {
      xl: "8px",
      primaryButton: "8px",
      secondaryButton: "8px",
    },
  },
  fontWeight: {
    normal: "300",
    medium: "400",
    semibold: "500",
    bold: "600",
    extrabold: "700",

    modalHeading: "500",
    tokenSelect: "600",
    primaryButton: "600",
    secondaryButton: "600",
  },
  color: {
    accent: portoPalette.primaryPurple,
    textMuted: portoPalette.greyFour,
    tooltipBackground: portoPalette.greyThree,
    summaryItemBackground: portoPalette.greyTwo,
    background: portoPalette.greyOne,
    backgroundMuted: portoPalette.greyThree,
    stakeSectionBackground: portoPalette.greyTwo,
    tokenSelectBackground: portoPalette.greyTwo,
    tokenSelectHoverBackground: portoPalette.greyThree,
    tokenSelectBorder: portoPalette.primaryPurple,
    dashboardDetailsSectionBackground: portoPalette.greyTwo,
    tabBorder: portoPalette.greyThree,

    modalBodyBackground: portoPalette.greyOne,

    skeletonLoaderBase: portoPalette.greyTwo,
    skeletonLoaderHighlight: portoPalette.greyThree,

    primaryButtonBackground: portoPalette.primaryPurple,
    primaryButtonColor: vars.color.white,

    smallButtonBackground: portoPalette.greyThree,
    smallLightButtonBackground: portoPalette.greyThree,

    summaryLabelStakedBackground: portoPalette.greyThree,
    summaryLabelStakedColor: vars.color.white,
    summaryLabelApyBackground: portoPalette.greyThree,
    summaryLabelApyColor: vars.color.white,
    summaryLabelAvailableBackground: portoPalette.greyThree,
    summaryLabelAvailableColor: vars.color.white,

    connectKit: {
      modalBackground: portoPalette.greyOne,
      profileForeground: portoPalette.greyOne,
      profileAction: portoPalette.greyTwo,
      profileActionHover: portoPalette.greyThree,
    },
  },
};
