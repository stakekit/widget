import type { ConnectKitTheme } from "../connect-kit";

const baseColorsContract = {
  white: "",
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
  tokenSelectBorder: "",
  tokenSelect: "",

  skeletonLoaderBase: "",
  skeletonLoaderHighlight: "",

  tabBorder: "",

  stakeSectionBackground: "",

  dropdownBackground: "",

  selectValidatorMultiSelectedBackground: "",
  selectValidatorMultiDefaultBackground: "",

  warningBoxBackground: "",

  positionsClaimRewardsBackground: "",
  positionsActionRequiredBackground: "",
  positionsPendingBackground: "",
  positionsRewardRate: "",

  modalOverlayBackground: "",
  modalBodyBackground: "",

  tooltipBackground: "",

  primaryButtonColor: "",
  primaryButtonBackground: "",

  secondaryButtonColor: "",
  secondaryButtonBackground: "",

  smallButtonColor: "",
  smallButtonBackground: "",

  smallLightButtonColor: "",
  smallLightButtonBackground: "",

  disabledButtonColor: "",
  disabledButtonBackground: "",

  dashboardDetailsSectionBackground: "",

  summaryItemBackground: "",
  summaryLabelStakedBackground: "",
  summaryLabelStakedColor: "",
  summaryLabelApyBackground: "",
  summaryLabelApyColor: "",
  summaryLabelAvailableBackground: "",
  summaryLabelAvailableColor: "",
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
