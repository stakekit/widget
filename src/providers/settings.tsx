import type { PropsWithChildren, ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { config } from "../config";
import type { SKExternalProviders } from "../domain/types/wallets";
import type { ThemeWrapperTheme } from "./theme-wrapper";
import type { Properties, TrackEventVal, TrackPageVal } from "./tracking";
import type { BuildWagmiConfig } from "./wagmi";

export type VariantProps =
  | {
      variant: "zerion";
      chainModal: (args: {
        selectedChainId: number;
        chainIds: number[];
        onSwitchChain: (chainId: number) => void;
      }) => ReactNode;
    }
  | { variant: "default" };

export type SettingsProps = {
  apiKey: string;
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
  externalProviders?: SKExternalProviders;
  disableGasCheck?: boolean;
  hideNetworkLogo?: boolean;
  disableInitLayoutAnimation?: boolean;
};

export type SettingsContextType = SettingsProps & VariantProps;

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
