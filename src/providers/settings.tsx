import { APIManager } from "@stakekit/api-hooks";
import { ThemeWrapperTheme } from "./theme-wrapper";
import { PropsWithChildren, createContext, useContext, useMemo } from "react";
import { Properties, TrackEventVal, TrackPageVal } from "./tracking";
import { BuildWagmiConfig } from "./wagmi";
import { config } from "../config";
import { SKExternalProviders } from "../domain/types/wallets/safe-wallet";

export interface SettingsContextType {
  apiKey: Parameters<(typeof APIManager)["configure"]>[0]["apiKey"];
  theme?: ThemeWrapperTheme;
  referralCheck?: boolean;
  tracking?: {
    trackEvent: (event: TrackEventVal, properties?: Properties) => void;
    trackPageView: (page: TrackPageVal, properties?: Properties) => void;
  };
  onMountAnimationComplete?: () => void;
  wagmi?: {
    forceWalletConnectOnly?: boolean;
    __customConnectors__?: Parameters<BuildWagmiConfig>[0]["customConnectors"];
  };
  showQueryDevtools?: boolean;
  externalProviders?: SKExternalProviders;
  disableGasCheck?: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsContextProvider = ({
  children,
  ...rest
}: PropsWithChildren<SettingsContextType>) => {
  const value = useMemo(
    () => ({
      ...rest,
      wagmi: {
        ...rest.wagmi,
        __customConnectors__: config.env.isTestMode
          ? rest.wagmi?.__customConnectors__
          : undefined,
      },
    }),
    [rest]
  );

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
