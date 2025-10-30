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

  dashboardDetailsSectionBackground: "",

  summaryItemBackground: "",
};

export const colorsContract: typeof baseColorsContract & {
  connectKit: ConnectKitTheme["colors"];
  __internal__utila__grey__one__: string;
  __internal__utila__border__: string;
  __internal__utila__select__token__border__: string;
  __internal__utila__primary__blue__: string;
  __internal__utila__primary__blue__hover__: string;
  __internal__utila__primary__blue__active__: string;
  __internal__utila__tab__page__divider__: string;
  __internal__utila__max__button__background__: string;
  __internal__utila__max__button__text__: string;
  __internal__utila__badge__text__success__: string;
  __internal__utila__badge__text__error__: string;

  __internal__finery__grey__one__: string;
  __internal__finery__grey__two__: string;
  __internal__finery__grey__three__: string;

  __internal__finery__green__one__: string;
  __internal__finery__green__two__: string;
  __internal__finery__green__three__: string;

  __internal__finery__purple__one__: string;
  __internal__finery__purple__two__: string;

  __internal__finery__blue__one__: string;
  __internal__finery__blue__two__: string;

  __internal__finery__summary__item__background__: string;

  __internal__porto__grey__one__: string;
  __internal__porto__grey__two__: string;
  __internal__porto__grey__three__: string;
  __internal__porto__grey__four__: string;
  __internal__porto__primary__purple__: string;
  __internal__porto__primary__purple__hover__: string;
  __internal__porto__primary__purple__active__: string;
} = {
  ...baseColorsContract,
  __internal__utila__grey__one__: "",
  __internal__utila__border__: "",
  __internal__utila__select__token__border__: "",
  __internal__utila__primary__blue__: "",
  __internal__utila__tab__page__divider__: "",
  __internal__utila__primary__blue__hover__: "",
  __internal__utila__primary__blue__active__: "",
  __internal__utila__max__button__background__: "",
  __internal__utila__max__button__text__: "",
  __internal__utila__badge__text__success__: "",
  __internal__utila__badge__text__error__: "",
  __internal__finery__grey__one__: "",
  __internal__finery__grey__two__: "",
  __internal__finery__grey__three__: "",
  __internal__finery__green__one__: "",
  __internal__finery__green__two__: "",
  __internal__finery__green__three__: "",
  __internal__finery__purple__one__: "",
  __internal__finery__purple__two__: "",
  __internal__finery__blue__one__: "",
  __internal__finery__blue__two__: "",
  __internal__finery__summary__item__background__: "",
  __internal__porto__grey__one__: "",
  __internal__porto__grey__two__: "",
  __internal__porto__grey__three__: "",
  __internal__porto__grey__four__: "",
  __internal__porto__primary__purple__: "",
  __internal__porto__primary__purple__hover__: "",
  __internal__porto__primary__purple__active__: "",
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
