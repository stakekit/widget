import type { ValidatorsConfig } from "../../domain/earn/yield";
import type { ExternalProviderSnapshot } from "../../public-api/external-provider-contract";
import type { VariantProps } from "../../public-api/react-types";
import type {
  PreferredTokenYieldsPerNetwork,
  SettingsProps,
} from "../../public-api/types";

type ZerionChainModal = Extract<
  VariantProps,
  { readonly variant: "zerion" }
>["chainModal"];

export type WidgetConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly borrowApiUrl: string;
  readonly borrowEnabled: boolean;
  readonly chainIconMapping?: SettingsProps["chainIconMapping"];
  readonly chainModal?: ZerionChainModal;
  readonly customTranslations?: SettingsProps["customTranslations"];
  readonly dashboardVariant: boolean;
  readonly dashboardYieldCategoryOrder: NonNullable<
    SettingsProps["dashboardYieldCategoryOrder"]
  >;
  readonly disableAutoScrollToTop: boolean;
  readonly disableInitLayoutAnimation: boolean;
  readonly disableInjectedProviderDiscovery: boolean;
  readonly disableResizingInputFontSize: boolean;
  readonly externalProviders?: ExternalProviderSnapshot;
  readonly forceWalletConnectOnly: boolean;
  readonly hideAccountAndChainSelector: boolean;
  readonly hideChainSelector: boolean;
  readonly hideNetworkLogo: boolean;
  readonly initialChain?: SettingsProps["initialChain"];
  readonly institutionalWallets: boolean;
  readonly isLedgerLive: boolean;
  readonly isSafe: boolean;
  readonly language?: SettingsProps["language"];
  readonly mapWalletFn?: SettingsProps["mapWalletFn"];
  readonly mountAnimationStartsFinished: boolean;
  readonly onMountAnimationComplete?: SettingsProps["onMountAnimationComplete"];
  readonly portalContainer?: SettingsProps["portalContainer"];
  readonly preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork;
  readonly theme?: SettingsProps["theme"];
  readonly tokenIconMapping?: SettingsProps["tokenIconMapping"];
  readonly tonConnectManifestUrl?: SettingsProps["tonConnectManifestUrl"];
  readonly tracking?: SettingsProps["tracking"];
  readonly validatorsConfig: ValidatorsConfig;
  readonly variant: VariantProps["variant"];
  readonly walletPolicy?: SettingsProps["walletPolicy"];
  readonly yieldGrouping: NonNullable<SettingsProps["yieldGrouping"]>;
  readonly yieldsApiUrl: string;
};
