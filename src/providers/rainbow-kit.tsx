import {
  darkTheme,
  lightTheme,
  Theme,
  RainbowKitProvider,
  Chain as RainbowKitChain,
} from "@stakekit/rainbowkit";
import merge from "lodash.merge";
import { PropsWithChildren } from "react";
import { id, vars } from "../styles";
import { RecursivePartial } from "../types";
import { usePrefersColorScheme } from "../hooks";
import { useSettings } from "./settings";

const overrides: RecursivePartial<Theme> = {
  radii: {
    actionButton: vars.borderRadius["2xl"],
  },
};

const theme: Theme = {
  lightMode: merge(lightTheme(), overrides),
  darkMode: merge(darkTheme(), overrides),
};

export const RainbowKitProviderWithTheme = ({
  children,
  chains,
}: PropsWithChildren<{
  chains: RainbowKitChain[];
}>) => {
  const { connectKitForceTheme } = useSettings();

  const scheme = usePrefersColorScheme();

  return (
    <RainbowKitProvider
      id={id}
      modalSize="compact"
      chains={chains}
      theme={
        connectKitForceTheme
          ? theme[connectKitForceTheme]
          : scheme === "light"
          ? theme.lightMode
          : scheme === "dark"
          ? theme.darkMode
          : theme
      }
    >
      {children}
    </RainbowKitProvider>
  );
};
