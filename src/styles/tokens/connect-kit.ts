import { lightTheme, darkTheme } from "@stakekit/rainbowkit";

export const connectKitTheme = {
  lightMode: lightTheme(),
  darkMode: darkTheme(),
};

export type ConnectKitTheme = (typeof connectKitTheme)["lightMode"];
