import { APIManager } from "@stakekit/api-hooks";
import { ThemeWrapperTheme } from "./theme-wrapper";
import { PropsWithChildren, createContext, useContext, useMemo } from "react";
import { Properties, TrackEventVal, TrackPageVal } from "./tracking";

export interface SettingsContextType {
  apiKey: Parameters<(typeof APIManager)["configure"]>[0]["apiKey"];
  theme?: ThemeWrapperTheme;
  connectKitForceTheme?: "lightMode" | "darkMode";
  tracking?: {
    trackEvent: (event: TrackEventVal, properties?: Properties) => void;
    trackPageView: (page: TrackPageVal, properties?: Properties) => void;
  };
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsContextProvider = ({
  children,
  ...rest
}: PropsWithChildren<SettingsContextType>) => {
  const value = useMemo(() => rest, [rest]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error(
      "useSettings must be used within a SettingsContextProvider"
    );
  }

  return context;
};
