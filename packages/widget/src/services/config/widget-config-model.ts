import type { BorrowMarketsScope } from "../../domain/borrow/catalog/market";
import type { DashboardYieldCategory } from "../../domain/earn/contract";
import type {
  PreferredTokenYieldsPerNetwork,
  ValidatorsConfig,
} from "../../domain/earn/yield";
import type { YieldProviderOrder } from "../../domain/earn/yield-provider-order";
import type { SupportedSKChainIds } from "../../domain/wallet/chain-ids";
import type { WalletPolicy } from "../../domain/wallet/wallet-policy";
import type { VariantProps } from "../../public-api/react-types";
import type { SettingsProps } from "../../public-api/types";
import type { ExternalProviderSnapshot } from "./external-provider-snapshot";
import type { HostProfile, WidgetVariant } from "./host-profile";

type YieldGrouping = "flat" | "category";

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
  readonly borrowMarketsScope: BorrowMarketsScope;
  readonly chainIconMapping?: SettingsProps["chainIconMapping"];
  readonly chainModal?: ZerionChainModal;
  readonly customTranslations?: CustomTranslations;
  readonly dashboardVariant: boolean;
  readonly dashboardYieldCategoryOrder: ReadonlyArray<DashboardYieldCategory>;
  readonly disableAutoScrollToTop: boolean;
  readonly disableInitLayoutAnimation: boolean;
  readonly disableInjectedProviderDiscovery: boolean;
  readonly disableResizingInputFontSize: boolean;
  readonly externalProviders?: ExternalProviderSnapshot;
  readonly hideAccountAndChainSelector: boolean;
  readonly hideChainSelector: boolean;
  readonly hideGasFee: boolean;
  readonly hideNetworkLogo: boolean;
  /** Capabilities resolved once from `variant` and `dashboardVariant`. */
  readonly hostProfile: HostProfile;
  readonly initialChain?: SupportedSKChainIds;
  readonly institutionalWallets: boolean;
  readonly isLedgerLive: boolean;
  readonly isSafe: boolean;
  readonly language?: WidgetLanguage;
  readonly mapWalletFn?: SettingsProps["mapWalletFn"];
  readonly mountAnimationStartsFinished: boolean;
  readonly onMountAnimationComplete?: SettingsProps["onMountAnimationComplete"];
  readonly portalContainer?: SettingsProps["portalContainer"];
  readonly preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork;
  readonly theme?: SettingsProps["theme"];
  readonly tokenIconMapping?: SettingsProps["tokenIconMapping"];
  readonly tonConnectManifestUrl?: string;
  readonly tracking?: SettingsProps["tracking"];
  readonly validatorsConfig: ValidatorsConfig;
  readonly variant: WidgetVariant;
  readonly walletPolicy?: WalletPolicy;
  readonly yieldGrouping: YieldGrouping;
  readonly yieldProviderOrder: YieldProviderOrder;
  readonly yieldsApiUrl: string;
};
