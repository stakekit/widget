import { connectKitTheme } from "../connect-kit";
import { colorsContract } from "./contract";

export const lightThemeColors: typeof colorsContract = {
  white: "#fff",
  black: "#000",
  transparent: "transparent",
  primary: "#fff",
  accent: "#000",
  disabled: "#E0E0E0",

  text: "#373737",
  textMuted: "#999999",
  textDanger: "#FF1515",

  background: "#fff",
  backgroundMuted: "#F6F7F9",

  tokenSelectBackground: "#F6F7F9",
  tokenSelectHoverBackground: "#EEF0F2",
  tokenSelect: "#373737",

  tabBorder: "#000000",

  skeletonLoaderBase: "#F6F7F9",
  skeletonLoaderHighlight: "#fff",

  warningBoxBackground: "#F6F7F9",

  stakeSectionBackground: "#F6F7F9",

  dropdownBackground: "#F6F7F9",

  selectValidatorMultiSelectedBackground: "#2DC969",
  selectValidatorMultiDefaultBackground: "#fff",

  positionsSectionBackgroundColor: "#FFFFFF",
  positionsSectionBorderColor: "#373737",
  positionsSectionDividerColor: "#F6F7F9",
  positionsClaimRewardsBackground: "#45D65C",
  positionsActionRequiredBackground: "#FA6878",

  modalOverlayBackground: "rgba(0, 0, 0, 0.5)",
  modalBodyBackground: "#FFFFFF",

  tooltipBackground: "#000000",

  primaryButtonColor: "#FFFFFF",
  primaryButtonBackground: "#000000",
  primaryButtonOutline: "#000000",
  primaryButtonHoverColor: "#FFFFFF",
  primaryButtonHoverBackground: "#1A1A1A",
  primaryButtonHoverOutline: "#1A1A1A",
  primaryButtonActiveColor: "#FFFFFF",
  primaryButtonActiveBackground: "#000000",
  primaryButtonActiveOutline: "#000000",

  secondaryButtonColor: "#000000",
  secondaryButtonBackground: "#FFFFFF",
  secondaryButtonOutline: "#000000",
  secondaryButtonHoverColor: "#373737",
  secondaryButtonHoverBackground: "#FFFFFF",
  secondaryButtonHoverOutline: "#373737",
  secondaryButtonActiveColor: "#000000",
  secondaryButtonActiveBackground: "#FFFFFF",
  secondaryButtonActiveOutline: "#000000",

  disabledButtonColor: "#FFFFFF",
  disabledButtonBackground: "#E0E0E0",
  disabledButtonOutline: "#E0E0E0",
  disabledButtonHoverColor: "#FFFFFF",
  disabledButtonHoverBackground: "#E6E6E6",
  disabledButtonHoverOutline: "#E0E0E0",
  disabledButtonActiveColor: "#FFFFFF",
  disabledButtonActiveBackground: "#E0E0E0",
  disabledButtonActiveOutline: "#E0E0E0",

  connectKit: {
    ...connectKitTheme.lightMode.colors,
    modalBackground: "#FFFFFF",
    profileForeground: "#FFFFFF",
    profileAction: "#F6F7F9",
    profileActionHover: "#E0E0E0",
    modalBackdrop: "rgba(0, 0, 0, 0.5)",
  },
};

export const darkThemeColors: typeof colorsContract = {
  white: "#fff",
  black: "#000",
  transparent: "transparent",
  primary: "#2B2B2B",
  accent: "#3B6CEC",
  disabled: "#E0E0E0",

  text: "#FFFFFF",
  textMuted: "#999999",
  textDanger: "#FF1515",

  background: "#2B2B2B",
  backgroundMuted: "#363636",

  tokenSelectBackground: "#363636",
  tokenSelectHoverBackground: "#444444",
  tokenSelect: "#FFFFFF",

  tabBorder: "#FFFFFF",

  skeletonLoaderBase: "#363636",
  skeletonLoaderHighlight: "#2B2B2B",

  warningBoxBackground: "#363636",

  stakeSectionBackground: "#363636",

  dropdownBackground: "#363636",

  selectValidatorMultiSelectedBackground: "#2DC969",
  selectValidatorMultiDefaultBackground: "#2B2B2B",

  positionsSectionBackgroundColor: "#2B2B2B",
  positionsSectionBorderColor: "#2B2B2B",
  positionsSectionDividerColor: "#363636",
  positionsClaimRewardsBackground: "#45D65C",
  positionsActionRequiredBackground: "#FA6878",

  modalOverlayBackground: "rgba(0, 0, 0, 0.5)",
  modalBodyBackground: "#2B2B2B",

  tooltipBackground: "#000000",

  primaryButtonColor: "#000000",
  primaryButtonBackground: "#FFFFFF",
  primaryButtonOutline: "#FFFFFF",
  primaryButtonHoverColor: "#373737",
  primaryButtonHoverBackground: "#E6E6E6",
  primaryButtonHoverOutline: "#E6E6E6",
  primaryButtonActiveColor: "#000000",
  primaryButtonActiveBackground: "#FFFFFF",
  primaryButtonActiveOutline: "#000000",

  secondaryButtonColor: "#FFFFFF",
  secondaryButtonBackground: "#2B2B2B",
  secondaryButtonOutline: "#FFFFFF",
  secondaryButtonHoverColor: "#FFFFFF",
  secondaryButtonHoverBackground: "#2B2B2B",
  secondaryButtonHoverOutline: "#F6F7F9",
  secondaryButtonActiveColor: "#FFFFFF",
  secondaryButtonActiveBackground: "#2B2B2B",
  secondaryButtonActiveOutline: "#FFFFFF",

  disabledButtonColor: "#000000",
  disabledButtonBackground: "#E0E0E0",
  disabledButtonOutline: "#FFFFFF",
  disabledButtonHoverColor: "#000000",
  disabledButtonHoverBackground: "#E6E6E6",
  disabledButtonHoverOutline: "#F6F7F9",
  disabledButtonActiveColor: "#000000",
  disabledButtonActiveBackground: "#E0E0E0",
  disabledButtonActiveOutline: "#FFFFFF",

  connectKit: {
    ...connectKitTheme.darkMode.colors,
    modalBackground: "#2B2B2B",
    profileForeground: "#2B2B2B",
    profileAction: "#363636",
    profileActionHover: "#444444",
    modalBackdrop: "rgba(0, 0, 0, 0.5)",
  },
};
