import type { Chain, WalletList } from "@stakekit/rainbowkit";
import type { ReactNode } from "react";
import type {
  SupportedSKChainIds,
  SupportedSKChains,
} from "../../domain/types/chains";
import type { PreferredTokenYieldsPerNetwork } from "../../domain/types/stake";
import type { TokenDto } from "../../domain/types/tokens";
import type { SKExternalProviders } from "../../domain/types/wallets";
import type { DashboardYieldCategory } from "../../domain/types/yields";
import type { Languages, localResources } from "../../translation/resources";
import type { RecursivePartial } from "../../types/utils";
import type { ThemeWrapperTheme } from "../theme-wrapper-types";
import type {
  Properties,
  TrackEventVal,
  TrackPageVal,
} from "../tracking/types";

type YieldGrouping = "flat" | "category";

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
  yieldsApiUrl?: string;
  theme?: ThemeWrapperTheme;
  tracking?: {
    trackEvent?: (event: TrackEventVal, properties?: Properties) => void;
    trackPageView?: (page: TrackPageVal, properties?: Properties) => void;
  };
  onMountAnimationComplete?: () => void;
  wagmi?: {
    forceWalletConnectOnly?: boolean;
    __customConnectors__?: (chains: Chain[]) => WalletList;
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
  mapWalletFn?: (props: {
    id: string;
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  }) => {
    iconUrl: string | (() => Promise<string>);
    name: string;
    iconBackground: string;
  };
  mapWalletListFn?: (val: WalletList) => WalletList;
  customTranslations?: RecursivePartial<typeof localResources>;
  tokensForEnabledYieldsOnly?: boolean;
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
  dashboardYieldCategoryOrder?: DashboardYieldCategory[];
  yieldGrouping?: YieldGrouping;
  institutionalWallets?: boolean;
  hideChainSelector?: boolean;
  hideAccountAndChainSelector?: boolean;
  preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork;
  portalContainer?: HTMLElement;
  tonConnectManifestUrl?: string;
  initialChain?: SupportedSKChainIds;
};

type ResolvedSettingsProps = Omit<
  SettingsProps,
  "dashboardYieldCategoryOrder" | "yieldGrouping"
> & {
  dashboardYieldCategoryOrder: DashboardYieldCategory[];
  yieldGrouping: YieldGrouping;
};

export type SettingsContextType = ResolvedSettingsProps & VariantProps;
