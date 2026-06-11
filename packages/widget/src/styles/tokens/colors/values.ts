import { vars } from "../../theme/contract.css";
import { connectKitTheme } from "../connect-kit";
import type { colorsContract } from "./contract";

const primitiveColors = {
  transparent: "transparent",
  white: "#fff",
  whiteFull: "#FFFFFF",
  black: "#000",
  blackFull: "#000000",
  overlay: {
    black50: "rgba(0, 0, 0, 0.5)",
    black2: "#00000005",
  },
  neutral: {
    50: "#F6F7F9",
    100: "#EEF0F2",
    150: "#eaedf1",
    200: "#e8e8e8",
    300: "#E0E0E0",
    350: "#E6E6E6",
    500: "#999999",
    600: "#444444",
    650: "#434343",
    700: "#373737",
    750: "#363636",
    800: "#2B2B2B",
    850: "#212121",
    900: "#1A1A1A",
  },
  blue: {
    500: "#3B6CEC",
  },
  green: {
    500: "#2DC969",
    600: "#16A34A",
    700: "#45D65C",
  },
  red: {
    500: "#FF1515",
    600: "#FA6878",
  },
  amber: {
    500: "#FFAA07",
  },
} as const;

const sharedSemanticColors = {
  base: {
    white: primitiveColors.white,
    transparent: primitiveColors.transparent,
    disabled: primitiveColors.neutral[300],
  },
  status: {
    success: primitiveColors.green[700],
    danger: primitiveColors.red[600],
    warning: primitiveColors.amber[500],
    rewardRate: primitiveColors.green[600],
    selected: primitiveColors.green[500],
  },
  overlay: {
    modal: primitiveColors.overlay.black50,
  },
} as const;

const lightSemanticColors = {
  brand: {
    primary: primitiveColors.white,
    accent: primitiveColors.black,
  },
  foreground: {
    default: primitiveColors.neutral[700],
    muted: primitiveColors.neutral[500],
    danger: primitiveColors.red[500],
    inverse: primitiveColors.whiteFull,
  },
  background: {
    default: primitiveColors.white,
    muted: primitiveColors.neutral[50],
    elevated: primitiveColors.whiteFull,
    subtle: primitiveColors.neutral[50],
    dropdown: primitiveColors.neutral[200],
    tooltip: primitiveColors.blackFull,
  },
  border: {
    default: primitiveColors.blackFull,
  },
  interaction: {
    mutedHover: primitiveColors.neutral[100],
    subtleHover: primitiveColors.neutral[150],
  },
} as const;

const darkSemanticColors = {
  brand: {
    primary: primitiveColors.neutral[800],
    accent: primitiveColors.blue[500],
  },
  foreground: {
    default: primitiveColors.whiteFull,
    muted: primitiveColors.neutral[500],
    danger: primitiveColors.red[500],
    inverse: primitiveColors.blackFull,
  },
  background: {
    default: primitiveColors.neutral[800],
    muted: primitiveColors.neutral[750],
    elevated: primitiveColors.neutral[800],
    subtle: primitiveColors.neutral[750],
    dropdown: primitiveColors.neutral[750],
    tooltip: primitiveColors.blackFull,
  },
  border: {
    default: primitiveColors.whiteFull,
  },
  interaction: {
    mutedHover: primitiveColors.neutral[600],
    subtleHover: primitiveColors.neutral[650],
  },
} as const;

export const lightThemeColors: typeof colorsContract = {
  white: sharedSemanticColors.base.white,
  transparent: sharedSemanticColors.base.transparent,
  primary: lightSemanticColors.brand.primary,
  accent: "#4A60FF",
  disabled: sharedSemanticColors.base.disabled,

  text: lightSemanticColors.foreground.default,
  textMuted: lightSemanticColors.foreground.muted,
  textDanger: lightSemanticColors.foreground.danger,

  background: vars.color.primary,
  backgroundMuted: "#f5f5f6",

  tokenSelectBackground: "#f5f5f6",
  tokenSelectHoverBackground: lightSemanticColors.interaction.mutedHover,
  tokenSelectBorder: "#C9CFFF",
  tokenSelect: vars.color.text,

  tabBorder: "#e4e4e7",

  skeletonLoaderBase: vars.color.backgroundMuted,
  skeletonLoaderHighlight: vars.color.background,

  warningBoxBackground: "#FFE9BD",

  stakeSectionBackground: "#f5f5f6",

  dropdownBackground: lightSemanticColors.background.dropdown,

  selectValidatorMultiSelectedBackground: sharedSemanticColors.status.selected,
  selectValidatorMultiDefaultBackground: vars.color.background,

  positionsClaimRewardsBackground: "#4BAA82",
  positionsActionRequiredBackground: sharedSemanticColors.status.danger,
  positionsPendingBackground: sharedSemanticColors.status.warning,
  positionsRewardRate: sharedSemanticColors.status.rewardRate,

  modalOverlayBackground: sharedSemanticColors.overlay.modal,
  modalBodyBackground: vars.color.background,

  tooltipBackground: lightSemanticColors.background.tooltip,

  primaryButtonColor: vars.color.white,
  primaryButtonBackground: "#4A60FF",

  secondaryButtonColor: vars.color.text,
  secondaryButtonBackground: vars.color.background,

  smallButtonColor: vars.color.text,
  smallButtonBackground: vars.color.background,

  smallLightButtonColor: "#5C70FF",
  smallLightButtonBackground: "#F4F5FF",

  disabledButtonColor: vars.color.white,
  disabledButtonBackground: vars.color.disabled,

  connectKit: {
    ...connectKitTheme.lightMode.colors,
    modalBackground: vars.color.modalBodyBackground,
    profileForeground: vars.color.modalBodyBackground,
    profileAction: vars.color.backgroundMuted,
    profileActionHover: vars.color.disabled,
    modalBackdrop: sharedSemanticColors.overlay.modal,
  },

  dashboardDetailsSectionBackground: "#f5f5f6",
  summaryItemBackground: "#f5f5f6",
  summaryLabelStakedBackground: "#F6F0FF",
  summaryLabelStakedColor: "#5A36C0",
  summaryLabelApyBackground: "#F7ECFA",
  summaryLabelApyColor: "#CA6CBD",
  summaryLabelAvailableBackground: "#EEF7F3",
  summaryLabelAvailableColor: "#327C5F",
};

export const darkThemeColors: typeof colorsContract = {
  white: sharedSemanticColors.base.white,
  transparent: sharedSemanticColors.base.transparent,
  primary: "#171717",
  accent: "#AB95FF",
  disabled: sharedSemanticColors.base.disabled,

  text: darkSemanticColors.foreground.default,
  textMuted: "#87899C",
  textDanger: darkSemanticColors.foreground.danger,

  background: vars.color.primary,
  backgroundMuted: "#333333",

  tokenSelectBackground: "#282828",
  tokenSelectHoverBackground: "#333333",
  tokenSelectBorder: "#AB95FF",
  tokenSelect: vars.color.text,

  tabBorder: "#333333",

  skeletonLoaderBase: "#282828",
  skeletonLoaderHighlight: "#333333",

  warningBoxBackground: vars.color.backgroundMuted,

  stakeSectionBackground: "#282828",

  dropdownBackground: "#333333",

  selectValidatorMultiSelectedBackground: sharedSemanticColors.status.selected,
  selectValidatorMultiDefaultBackground: vars.color.background,

  positionsClaimRewardsBackground: sharedSemanticColors.status.success,
  positionsActionRequiredBackground: sharedSemanticColors.status.danger,
  positionsPendingBackground: sharedSemanticColors.status.warning,
  positionsRewardRate: sharedSemanticColors.status.success,

  modalOverlayBackground: sharedSemanticColors.overlay.modal,
  modalBodyBackground: vars.color.background,

  tooltipBackground: "#333333",

  primaryButtonColor: vars.color.white,
  primaryButtonBackground: "#AB95FF",

  secondaryButtonColor: vars.color.text,
  secondaryButtonBackground: vars.color.background,

  smallButtonColor: vars.color.text,
  smallButtonBackground: "#333333",

  smallLightButtonColor: vars.color.text,
  smallLightButtonBackground: "#333333",

  disabledButtonColor: primitiveColors.blackFull,
  disabledButtonBackground: vars.color.disabled,

  connectKit: {
    ...connectKitTheme.darkMode.colors,
    modalBackground: vars.color.modalBodyBackground,
    profileForeground: vars.color.modalBodyBackground,
    profileAction: "#282828",
    profileActionHover: "#333333",
    modalBackdrop: sharedSemanticColors.overlay.modal,
  },

  dashboardDetailsSectionBackground: "#282828",
  summaryItemBackground: "#282828",
  summaryLabelStakedBackground: "#333333",
  summaryLabelStakedColor: vars.color.white,
  summaryLabelApyBackground: "#333333",
  summaryLabelApyColor: vars.color.white,
  summaryLabelAvailableBackground: "#333333",
  summaryLabelAvailableColor: vars.color.white,
};
