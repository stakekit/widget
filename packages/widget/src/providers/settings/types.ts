import type { TokenDto, TransactionFormat } from "@stakekit/api-hooks";
import type { ReactNode } from "react";
import type { SupportedSKChains } from "../../domain/types/chains";
import type { PreferredTokenYieldsPerNetwork } from "../../domain/types/stake";
import type { SKExternalProviders } from "../../domain/types/wallets";
import type { Languages, localResources } from "../../translation";
import type { RecursivePartial } from "../../types/utils";
import type { ThemeWrapperTheme } from "../theme-wrapper";
import type { Properties, TrackEventVal, TrackPageVal } from "../tracking";
import type { BuildWagmiConfig } from "../wagmi";

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
  | { variant: "default" }
  | { variant: "finery" }
  | { variant: "porto" };

export type SettingsProps = {
  apiKey: string;
  baseUrl?: string;
  theme?: ThemeWrapperTheme;
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
  mapWalletListFn?: Parameters<BuildWagmiConfig>[0]["mapWalletListFn"];
  customTranslations?: RecursivePartial<typeof localResources>;
  tokensForEnabledYieldsOnly?: boolean;
  preferredTransactionFormat?: TransactionFormat;
  validatorsConfig?: {
    [Key in SupportedSKChains | "*"]?: {
      allowed?: string[];
      blocked?: string[];
      preferred?: string[];
      mergePreferredWithDefault?: boolean;
      preferredOnly?: boolean;
    };
  };
  tokenIconMapping?:
    | Record<TokenDto["symbol"], string>
    | ((token: TokenDto) => string);
  chainIconMapping?:
    | Record<SupportedSKChains, string>
    | ((chain: SupportedSKChains) => string);
  dashboardVariant?: boolean;
  hideChainSelector?: boolean;
  hideAccountAndChainSelector?: boolean;
  showUSDeBanner?: boolean;
  preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork;
  portalContainer?: HTMLElement;
  tonConnectManifestUrl?: string;
};

export type SettingsContextType = SettingsProps & VariantProps;
