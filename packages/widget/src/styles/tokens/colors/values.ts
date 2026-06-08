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
  accent: lightSemanticColors.brand.accent,
  disabled: sharedSemanticColors.base.disabled,

  text: lightSemanticColors.foreground.default,
  textMuted: lightSemanticColors.foreground.muted,
  textDanger: lightSemanticColors.foreground.danger,

  background: vars.color.primary,
  backgroundMuted: lightSemanticColors.background.muted,

  tokenSelectBackground: vars.color.backgroundMuted,
  tokenSelectHoverBackground: lightSemanticColors.interaction.mutedHover,
  tokenSelect: vars.color.text,

  tabBorder: lightSemanticColors.border.default,

  skeletonLoaderBase: vars.color.backgroundMuted,
  skeletonLoaderHighlight: vars.color.background,

  warningBoxBackground: vars.color.backgroundMuted,

  stakeSectionBackground: vars.color.backgroundMuted,

  dropdownBackground: lightSemanticColors.background.dropdown,

  selectValidatorMultiSelectedBackground: sharedSemanticColors.status.selected,
  selectValidatorMultiDefaultBackground: vars.color.background,

  positionsClaimRewardsBackground: sharedSemanticColors.status.success,
  positionsActionRequiredBackground: sharedSemanticColors.status.danger,
  positionsPendingBackground: sharedSemanticColors.status.warning,
  positionsRewardRate: sharedSemanticColors.status.rewardRate,

  modalOverlayBackground: sharedSemanticColors.overlay.modal,
  modalBodyBackground: vars.color.background,

  tooltipBackground: lightSemanticColors.background.tooltip,

  primaryButtonColor: vars.color.white,
  primaryButtonBackground: vars.color.accent,

  secondaryButtonColor: vars.color.text,
  secondaryButtonBackground: vars.color.background,

  smallButtonColor: vars.color.text,
  smallButtonBackground: vars.color.background,

  smallLightButtonColor: vars.color.text,
  smallLightButtonBackground: vars.color.backgroundMuted,

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

  dashboardDetailsSectionBackground: primitiveColors.overlay.black2,
  summaryItemBackground: vars.color.modalBodyBackground,
};

export const darkThemeColors: typeof colorsContract = {
  white: sharedSemanticColors.base.white,
  transparent: sharedSemanticColors.base.transparent,
  primary: darkSemanticColors.brand.primary,
  accent: darkSemanticColors.brand.accent,
  disabled: sharedSemanticColors.base.disabled,

  text: darkSemanticColors.foreground.default,
  textMuted: darkSemanticColors.foreground.muted,
  textDanger: darkSemanticColors.foreground.danger,

  background: vars.color.primary,
  backgroundMuted: darkSemanticColors.background.muted,

  tokenSelectBackground: vars.color.backgroundMuted,
  tokenSelectHoverBackground: darkSemanticColors.interaction.mutedHover,
  tokenSelect: vars.color.text,

  tabBorder: darkSemanticColors.border.default,

  skeletonLoaderBase: vars.color.backgroundMuted,
  skeletonLoaderHighlight: vars.color.background,

  warningBoxBackground: vars.color.backgroundMuted,

  stakeSectionBackground: vars.color.backgroundMuted,

  dropdownBackground: darkSemanticColors.background.dropdown,

  selectValidatorMultiSelectedBackground: sharedSemanticColors.status.selected,
  selectValidatorMultiDefaultBackground: vars.color.background,

  positionsClaimRewardsBackground: sharedSemanticColors.status.success,
  positionsActionRequiredBackground: sharedSemanticColors.status.danger,
  positionsPendingBackground: sharedSemanticColors.status.warning,
  positionsRewardRate: sharedSemanticColors.status.success,

  modalOverlayBackground: sharedSemanticColors.overlay.modal,
  modalBodyBackground: vars.color.background,

  tooltipBackground: darkSemanticColors.background.tooltip,

  primaryButtonColor: primitiveColors.blackFull,
  primaryButtonBackground: vars.color.white,

  secondaryButtonColor: vars.color.text,
  secondaryButtonBackground: vars.color.background,

  smallButtonColor: vars.color.text,
  smallButtonBackground: vars.color.background,

  smallLightButtonColor: vars.color.text,
  smallLightButtonBackground: vars.color.backgroundMuted,

  disabledButtonColor: primitiveColors.blackFull,
  disabledButtonBackground: vars.color.disabled,

  connectKit: {
    ...connectKitTheme.darkMode.colors,
    modalBackground: vars.color.modalBodyBackground,
    profileForeground: vars.color.modalBodyBackground,
    profileAction: vars.color.backgroundMuted,
    profileActionHover: darkSemanticColors.interaction.mutedHover,
    modalBackdrop: sharedSemanticColors.overlay.modal,
  },

  dashboardDetailsSectionBackground: primitiveColors.overlay.black2,
  summaryItemBackground: vars.color.modalBodyBackground,
};
