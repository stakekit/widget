import type { ConnectKitTheme } from "../connect-kit";

const baseColorsContract = {
  white: "",
  black: "",
  transparent: "",
  primary: "",
  accent: "",
  disabled: "",

  text: "",
  textMuted: "",
  textDanger: "",

  background: "",
  backgroundMuted: "",

  tokenSelectBackground: "",
  tokenSelectHoverBackground: "",
  tokenSelect: "",

  skeletonLoaderBase: "",
  skeletonLoaderHighlight: "",

  tabBorder: "",

  stakeSectionBackground: "",

  dropdownBackground: "",

  selectValidatorMultiSelectedBackground: "",
  selectValidatorMultiDefaultBackground: "",

  warningBoxBackground: "",

  positionsSectionBackgroundColor: "",
  positionsSectionBorderColor: "",
  positionsSectionDividerColor: "",
  positionsClaimRewardsBackground: "",
  positionsActionRequiredBackground: "",
  positionsPendingBackground: "",

  modalOverlayBackground: "",
  modalBodyBackground: "",

  tooltipBackground: "",

  primaryButtonColor: "",
  primaryButtonBackground: "",
  primaryButtonOutline: "",
  primaryButtonHoverColor: "",
  primaryButtonHoverBackground: "",
  primaryButtonHoverOutline: "",
  primaryButtonActiveColor: "",
  primaryButtonActiveBackground: "",
  primaryButtonActiveOutline: "",

  secondaryButtonColor: "",
  secondaryButtonBackground: "",
  secondaryButtonOutline: "",
  secondaryButtonHoverColor: "",
  secondaryButtonHoverBackground: "",
  secondaryButtonHoverOutline: "",
  secondaryButtonActiveColor: "",
  secondaryButtonActiveBackground: "",
  secondaryButtonActiveOutline: "",

  smallButtonColor: "",
  smallButtonBackground: "",
  smallButtonOutline: "",
  smallButtonHoverColor: "",
  smallButtonHoverBackground: "",
  smallButtonHoverOutline: "",
  smallButtonActiveColor: "",
  smallButtonActiveBackground: "",
  smallButtonActiveOutline: "",

  smallLightButtonColor: "",
  smallLightButtonBackground: "",
  smallLightButtonOutline: "",
  smallLightButtonHoverColor: "",
  smallLightButtonHoverBackground: "",
  smallLightButtonHoverOutline: "",
  smallLightButtonActiveColor: "",
  smallLightButtonActiveBackground: "",
  smallLightButtonActiveOutline: "",

  disabledButtonColor: "",
  disabledButtonBackground: "",
  disabledButtonOutline: "",
  disabledButtonHoverColor: "",
  disabledButtonHoverBackground: "",
  disabledButtonHoverOutline: "",
  disabledButtonActiveColor: "",
  disabledButtonActiveBackground: "",
  disabledButtonActiveOutline: "",
};

export const colorsContract: typeof baseColorsContract & {
  connectKit: ConnectKitTheme["colors"];
} = {
  ...baseColorsContract,
  connectKit: {
    accentColor: "",
    accentColorForeground: "",
    actionButtonBorder: "",
    actionButtonBorderMobile: "",
    actionButtonSecondaryBackground: "",
    closeButton: "",
    closeButtonBackground: "",
    connectButtonBackground: "",
    connectButtonBackgroundError: "",
    connectButtonInnerBackground: "",
    connectButtonText: "",
    connectButtonTextError: "",
    connectionIndicator: "",
    downloadBottomCardBackground: "",
    downloadTopCardBackground: "",
    error: "",
    generalBorder: "",
    generalBorderDim: "",
    menuItemBackground: "",
    modalBackdrop: "",
    modalBackground: "",
    modalBorder: "",
    modalText: "",
    modalTextDim: "",
    modalTextSecondary: "",
    profileAction: "",
    profileActionHover: "",
    profileForeground: "",
    selectedOptionBorder: "",
    standby: "",
  },
};
