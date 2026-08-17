import type {
  PreferredTokenYieldsPerNetwork,
  SettingsProps,
  VariantProps,
} from "../../public-api/types";
import type { ExternalProviderSnapshot } from "../wallet/external-provider";

type NormalizedValidatorsConfig = Readonly<
  Record<
    string,
    {
      readonly allowed?: ReadonlyArray<string>;
      readonly blocked?: ReadonlyArray<string>;
      readonly mergePreferredWithDefault: boolean;
      readonly preferred?: ReadonlyArray<string>;
      readonly preferredOnly: boolean;
    }
  >
>;

type NormalizedWagmiConfig = {
  readonly __customConnectors__?: NonNullable<
    SettingsProps["wagmi"]
  >["__customConnectors__"];
  readonly forceWalletConnectOnly: boolean;
};

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
  readonly hideAccountAndChainSelector: boolean;
  readonly hideChainSelector: boolean;
  readonly hideNetworkLogo: boolean;
  readonly initialChain?: SettingsProps["initialChain"];
  readonly institutionalWallets: boolean;
  readonly isLedgerLive: boolean;
  readonly isSafe: boolean;
  readonly language?: SettingsProps["language"];
  readonly mapWalletFn?: SettingsProps["mapWalletFn"];
  readonly mapWalletListFn?: SettingsProps["mapWalletListFn"];
  readonly mountAnimationStartsFinished: boolean;
  readonly onMountAnimationComplete?: SettingsProps["onMountAnimationComplete"];
  readonly portalContainer?: SettingsProps["portalContainer"];
  readonly preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork;
  readonly theme?: SettingsProps["theme"];
  readonly tokenIconMapping?: SettingsProps["tokenIconMapping"];
  readonly tonConnectManifestUrl?: SettingsProps["tonConnectManifestUrl"];
  readonly tracking?: SettingsProps["tracking"];
  readonly validatorsConfig: NormalizedValidatorsConfig;
  readonly variant: VariantProps["variant"];
  readonly wagmi: NormalizedWagmiConfig;
  readonly yieldGrouping: NonNullable<SettingsProps["yieldGrouping"]>;
  readonly yieldsApiUrl: string;
};
