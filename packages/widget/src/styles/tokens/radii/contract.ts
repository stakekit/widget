import type { ConnectKitTheme } from "../connect-kit";

const baseContract = {
  none: "",
  sm: "",
  base: "",
  md: "",
  lg: "",
  xl: "",
  "2xl": "",
  "3xl": "",
  full: "",
  half: "",

  widgetBorderRadius: "",
  primaryButton: "",
  secondaryButton: "",
  smallButton: "",
};

export const radiiContract: {
  baseContract: typeof baseContract;
  connectKit: ConnectKitTheme["radii"];
} = {
  baseContract,
  connectKit: {
    actionButton: "",
    connectButton: "",
    menuButton: "",
    modal: "",
    modalMobile: "",
  },
};
