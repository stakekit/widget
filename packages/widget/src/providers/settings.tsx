import type { SupportedSKChains } from "@sk-widget/domain/types/chains";
import type { Languages, localResources } from "@sk-widget/translation";
import utilaTranslations from "@sk-widget/translation/English/utila-variant.json";
import type { RecursivePartial } from "@sk-widget/types";
import type { TokenDto, TransactionFormat } from "@stakekit/api-hooks";
import type { PropsWithChildren, ReactNode } from "react";
import { createContext, useContext, useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
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
  | { variant: "utila" }
  | { variant: "default" };

export type SettingsProps = {
  apiKey: string;
  baseUrl?: string;
  theme?: ThemeWrapperTheme;
  referralCheck?: boolean;
  tracking?: {
    trackEvent?: (event: TrackEventVal, properties?: Properties) => void;
    trackPageView?: (page: TrackPageVal, properties?: Properties) => void;
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
  disableResizingInputFontSize?: boolean;
  disableAutoScrollToTop?: boolean;
  language?: Languages;
  isSafe?: boolean;
  disableInjectedProviderDiscovery?: boolean;
  mapWalletFn?: Parameters<BuildWagmiConfig>[0]["mapWalletFn"];
  customTranslations?: RecursivePartial<typeof localResources>;
  tokensForEnabledYieldsOnly?: boolean;
  preferredTransactionFormat?: TransactionFormat;
  hideChainModal?: boolean;
  whitelistedValidatorAddresses?: string[];
  tokenIconMapping?:
    | Record<TokenDto["symbol"], string>
    | ((token: TokenDto) => string);
  chainIconMapping?:
    | Record<SupportedSKChains, string>
    | ((chain: SupportedSKChains) => string);
  showUSDeBanner?: boolean;
};

export type SettingsContextType = SettingsProps & VariantProps;

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const SettingsContextProvider = ({
  children,
  ...rest
}: PropsWithChildren<SettingsContextType>) => {
  if (!config.env.isTestMode && rest.wagmi?.__customConnectors__) {
    rest.wagmi.__customConnectors__ = undefined;
  }

  const { i18n } = useTranslation();

  useLayoutEffect(() => {
    if (rest.language) {
      i18n.changeLanguage(rest.language);
    }
  }, [rest.language, i18n]);

  useLayoutEffect(() => {
    if (rest.variant === "utila") {
      i18n.addResourceBundle(
        "en",
        "translation",
        utilaTranslations,
        true,
        true
      );
    }

    if (rest.customTranslations) {
      Object.entries(rest.customTranslations).forEach(([lng, val]) => {
        i18n.addResourceBundle(lng, "translation", val.translation, true, true);
      });
    }
  }, [rest.customTranslations, i18n, rest.variant]);

  return (
    <SettingsContext.Provider value={rest}>{children}</SettingsContext.Provider>
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
