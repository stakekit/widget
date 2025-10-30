import { connectKitTheme } from "../connect-kit";
import type { colorsContract } from "./contract";

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

  dropdownBackground: "#e8e8e8",

  selectValidatorMultiSelectedBackground: "#2DC969",
  selectValidatorMultiDefaultBackground: "#fff",

  positionsSectionBackgroundColor: "#FFFFFF",
  positionsSectionBorderColor: "#373737",
  positionsSectionDividerColor: "#F6F7F9",
  positionsClaimRewardsBackground: "#45D65C",
  positionsActionRequiredBackground: "#FA6878",
  positionsPendingBackground: "#FFAA07",

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

  secondaryButtonColor: "#373737",
  secondaryButtonBackground: "#FFFFFF",
  secondaryButtonOutline: "#000000",
  secondaryButtonHoverColor: "#373737",
  secondaryButtonHoverBackground: "#F6F7F9",
  secondaryButtonHoverOutline: "#000000",
  secondaryButtonActiveColor: "#373737",
  secondaryButtonActiveBackground: "#F6F7F9",
  secondaryButtonActiveOutline: "#000000",

  smallButtonColor: "#373737",
  smallButtonBackground: "#FFFFFF",
  smallButtonOutline: "#000000",
  smallButtonHoverColor: "#373737",
  smallButtonHoverBackground: "#F6F7F9",
  smallButtonHoverOutline: "#000000",
  smallButtonActiveColor: "#373737",
  smallButtonActiveBackground: "#F6F7F9",
  smallButtonActiveOutline: "#000000",

  smallLightButtonColor: "#373737",
  smallLightButtonBackground: "#F6F7F9",
  smallLightButtonOutline: "#F6F7F9",
  smallLightButtonHoverColor: "#373737",
  smallLightButtonHoverBackground: "#eaedf1",
  smallLightButtonHoverOutline: "#eaedf1",
  smallLightButtonActiveColor: "#373737",
  smallLightButtonActiveBackground: "#eaedf1",
  smallLightButtonActiveOutline: "#eaedf1",

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

  __internal__utila__grey__one__: "#F8F8F9",
  __internal__utila__border__: "#E7E8EB",
  __internal__utila__select__token__border__: "#C9CFFF",
  __internal__utila__primary__blue__: "#4A60FF",
  __internal__utila__primary__blue__hover__: "#5d70f7",
  __internal__utila__primary__blue__active__: "#5d70f7",
  __internal__utila__tab__page__divider__: "#E7E8EB",
  __internal__utila__max__button__background__: "#F4F5FF",
  __internal__utila__max__button__text__: "#5C70FF",
  __internal__utila__badge__text__success__: "#4BAA82",
  __internal__utila__badge__text__error__: "#E73F4A",

  __internal__finery__grey__one__: "#FDFDFD",
  __internal__finery__grey__two__: "#00000008",
  __internal__finery__grey__three__: "#0000000f",

  __internal__finery__green__one__: "#16C7B0",
  __internal__finery__green__two__: "#16c7b0ed",
  __internal__finery__green__three__: "#16C7B014",

  __internal__finery__purple__one__: "#F0EDFA",
  __internal__finery__purple__two__: "#5A36C0",

  __internal__finery__blue__one__: "#EDF1F5",
  __internal__finery__blue__two__: "#0059AB",

  __internal__finery__summary__item__background__: "#FFFFFF",

  __internal__porto__grey__one__: "#171717",
  __internal__porto__grey__two__: "#282828",
  __internal__porto__grey__three__: "#333333",
  __internal__porto__grey__four__: "#87899C",
  __internal__porto__primary__purple__: "#AB95FF",
  __internal__porto__primary__purple__hover__: "#BDA8FF",
  __internal__porto__primary__purple__active__: "#9982E6",

  dashboardDetailsSectionBackground: "#00000005",
  summaryItemBackground: "#FFFFFF",
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
  positionsPendingBackground: "#FFAA07",

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
  secondaryButtonHoverBackground: "#212121",
  secondaryButtonHoverOutline: "#FFFFFF",
  secondaryButtonActiveColor: "#FFFFFF",
  secondaryButtonActiveBackground: "#212121",
  secondaryButtonActiveOutline: "#FFFFFF",

  smallButtonColor: "#FFFFFF",
  smallButtonBackground: "#2B2B2B",
  smallButtonOutline: "#2B2B2B",
  smallButtonHoverColor: "#FFFFFF",
  smallButtonHoverBackground: "#212121",
  smallButtonHoverOutline: "#212121",
  smallButtonActiveColor: "#FFFFFF",
  smallButtonActiveBackground: "#212121",
  smallButtonActiveOutline: "#212121",

  smallLightButtonColor: "#FFFFFF",
  smallLightButtonBackground: "#363636",
  smallLightButtonOutline: "#363636",
  smallLightButtonHoverColor: "#FFFFFF",
  smallLightButtonHoverBackground: "#434343",
  smallLightButtonHoverOutline: "#434343",
  smallLightButtonActiveColor: "#FFFFFF",
  smallLightButtonActiveBackground: "#434343",
  smallLightButtonActiveOutline: "#434343",

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

  __internal__utila__grey__one__: "#F8F8F9",
  __internal__utila__border__: "#E7E8EB",
  __internal__utila__select__token__border__: "#C9CFFF",
  __internal__utila__primary__blue__: "#4A60FF",
  __internal__utila__primary__blue__hover__: "#5d70f7",
  __internal__utila__primary__blue__active__: "#5d70f7",
  __internal__utila__tab__page__divider__: "#E7E8EB",
  __internal__utila__max__button__background__: "#F4F5FF",
  __internal__utila__max__button__text__: "#5C70FF",
  __internal__utila__badge__text__success__: "#4BAA82",
  __internal__utila__badge__text__error__: "#E73F4A",

  __internal__finery__grey__one__: "#243034",
  __internal__finery__grey__two__: "#FFFFFF14",
  __internal__finery__grey__three__: "#FFFFFF28",

  __internal__finery__green__one__: "#16C7B0",
  __internal__finery__green__two__: "#16c7b0ed",
  __internal__finery__green__three__: "#16C7B014",

  __internal__finery__blue__one__: "#0059AB33",
  __internal__finery__blue__two__: "#42A1F8",

  __internal__finery__purple__one__: "#5A36C033",
  __internal__finery__purple__two__: "#CEBDFF",

  __internal__finery__summary__item__background__: "#FFFFFF14",

  __internal__porto__grey__one__: "#171717",
  __internal__porto__grey__two__: "#282828",
  __internal__porto__grey__three__: "#333333",
  __internal__porto__grey__four__: "#87899C",
  __internal__porto__primary__purple__: "#AB95FF",
  __internal__porto__primary__purple__hover__: "#BDA8FF",
  __internal__porto__primary__purple__active__: "#9982E6",

  dashboardDetailsSectionBackground: "#00000005",
  summaryItemBackground: "#2B2B2B",
};
