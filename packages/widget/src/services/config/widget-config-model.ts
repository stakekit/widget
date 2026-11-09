import type { BorrowMarketsScope } from "../../domain/borrow/market";
import type { YieldCategory } from "../../domain/earn/contract";
import type {
  PreferredTokenYieldsPerNetwork,
  ValidatorsConfig,
} from "../../domain/earn/yield";
import type { YieldProviderOrder } from "../../domain/earn/yield-provider-order";
import type { SupportedSKChainIds } from "../../domain/wallet/chain-ids";
import type { WalletPolicy } from "../../domain/wallet/wallet-policy";
import type { SKColorRole } from "../../public-api/appearance";
import type { VariantProps } from "../../public-api/react-types";
import type { SettingsProps } from "../../public-api/types";
import type { ExternalProviderSnapshot } from "./external-provider-snapshot";
import type { HostProfile, WidgetVariant } from "./host-profile";

type YieldGrouping = "flat" | "category";

/** Which shell and route tree the Widget renders. */
export type WidgetLayout = "Compact" | "Dashboard";

/** The color scheme the host asks for; `system` follows the OS preference. */
type WidgetColorScheme = "light" | "dark" | "system";

type CssValues<Key extends string> = Readonly<Partial<Record<Key, string>>>;

/**
 * The host's Appearance after the legacy theme mapping: the color scheme and
 * the CSS values set over the Design System's defaults. A legacy theme's
 * colors stay apart from the host's, in the scheme the theme was inferred as.
 */
export type WidgetAppearance = Readonly<{
  colorScheme: WidgetColorScheme;
  colors: Readonly<{
    light: CssValues<SKColorRole>;
    dark: CssValues<SKColorRole>;
  }>;
  legacyColors:
    | Readonly<{
        colorScheme: "light" | "dark";
        values: CssValues<SKColorRole>;
      }>
    | undefined;
  radius: CssValues<"badge" | "control" | "card" | "overlay" | "shell">;
  controlHeight: CssValues<"sm" | "md" | "lg">;
  font: CssValues<"sans" | "mono">;
  fontWeight: CssValues<"regular" | "medium" | "semibold">;
}>;

type WidgetLanguage = "en" | "fr";

type TranslationTree = Readonly<{
  [key: string]: string | TranslationTree;
}>;

type CustomTranslations = Partial<
  Record<WidgetLanguage, { readonly translation: TranslationTree }>
>;

/** Opaque host render capability; its signature is owned by the host contract. */
type ZerionChainModal = Extract<
  VariantProps,
  { readonly variant: "zerion" }
>["chainModal"];

export type WidgetConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly borrowApiUrl: string;
  readonly borrowEnabled: boolean;
  /** The host's `appearance` over its mapped legacy `theme`. */
  readonly appearance: WidgetAppearance;
  readonly borrowMarketsScope: BorrowMarketsScope;
  readonly chainIconMapping?: SettingsProps["chainIconMapping"];
  readonly chainModal?: ZerionChainModal;
  readonly customTranslations?: CustomTranslations;
  readonly yieldCategoryOrder: ReadonlyArray<YieldCategory>;
  readonly disableAutoScrollToTop: boolean;
  readonly disableInitLayoutAnimation: boolean;
  readonly disableInjectedProviderDiscovery: boolean;
  readonly disableResizingInputFontSize: boolean;
  /** Earn groups yields into category tabs; only the Dashboard Layout has them. */
  readonly earnCategoryGrouping: boolean;
  readonly externalProviders?: ExternalProviderSnapshot;
  readonly hideAccountAndChainSelector: boolean;
  readonly hideChainSelector: boolean;
  readonly hideGasFee: boolean;
  readonly hideNetworkLogo: boolean;
  /** Capabilities resolved once from `variant` and `layout`. */
  readonly hostProfile: HostProfile;
  readonly initialChain?: SupportedSKChainIds;
  readonly institutionalWallets: boolean;
  readonly isLedgerLive: boolean;
  readonly isSafe: boolean;
  /** The public `layout`, or else the deprecated `dashboardVariant` flag. */
  readonly layout: WidgetLayout;
  readonly language?: WidgetLanguage;
  readonly mapWalletFn?: SettingsProps["mapWalletFn"];
  readonly mountAnimationStartsFinished: boolean;
  readonly onMountAnimationComplete?: SettingsProps["onMountAnimationComplete"];
  readonly portalContainer?: SettingsProps["portalContainer"];
  readonly preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork;
  readonly tokenIconMapping?: SettingsProps["tokenIconMapping"];
  readonly tonConnectManifestUrl?: string;
  readonly tracking?: SettingsProps["tracking"];
  readonly validatorsConfig: ValidatorsConfig;
  readonly variant: WidgetVariant;
  readonly walletPolicy?: WalletPolicy;
  /** Defaults to `"category"` in the Dashboard Layout, else `"flat"`. */
  readonly yieldGrouping: YieldGrouping;
  readonly yieldProviderOrder: YieldProviderOrder;
  readonly yieldsApiUrl: string;
};
