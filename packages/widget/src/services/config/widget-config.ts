import { Context, type Effect, Layer, type Stream } from "effect";
import type { SKExternalProviders } from "../../domain/types/wallets";
import type { SettingsProps, VariantProps } from "../../public-api/types";
import { config } from "../../shared/config/widget-defaults";

type ResolvedSettingsProps = Omit<
  SettingsProps,
  "borrowEnabled" | "dashboardYieldCategoryOrder" | "yieldGrouping"
> & {
  readonly borrowEnabled: boolean;
  readonly dashboardYieldCategoryOrder: NonNullable<
    SettingsProps["dashboardYieldCategoryOrder"]
  >;
  readonly yieldGrouping: NonNullable<SettingsProps["yieldGrouping"]>;
};

type ZerionChainModal = Extract<
  VariantProps,
  { readonly variant: "zerion" }
>["chainModal"];

export type WidgetConfig = ResolvedSettingsProps & {
  readonly chainModal?: ZerionChainModal;
  readonly isLedgerLive: boolean;
  readonly variant: VariantProps["variant"];
};

type WagmiSettings = NonNullable<SettingsProps["wagmi"]>;

export type WidgetApiConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly borrowApiUrl: string;
  readonly yieldsApiUrl: string;
};

export const normalizeWidgetApiConfig = (
  settings: WidgetConfig
): WidgetApiConfig => ({
  apiKey: settings.apiKey,
  baseUrl: settings.baseUrl ?? config.env.apiUrl,
  borrowApiUrl: settings.borrowApiUrl ?? config.env.borrowApiUrl,
  yieldsApiUrl: settings.yieldsApiUrl ?? config.env.yieldsApiUrl,
});

type WidgetTrackingConfig = {
  readonly tracking: SettingsProps["tracking"];
  readonly variant: VariantProps["variant"];
};

type WidgetWalletConfig = {
  readonly chainIconMapping: SettingsProps["chainIconMapping"];
  readonly customConnectors: WagmiSettings["__customConnectors__"];
  readonly disableInjectedProviderDiscovery: boolean;
  readonly externalProviderInitToken: NonNullable<
    SKExternalProviders["initToken"]
  > | null;
  readonly hasExternalProvider: boolean;
  readonly forceWalletConnectOnly: boolean;
  readonly institutionalWallets: boolean;
  readonly isLedgerLive: boolean;
  readonly isSafe: boolean;
  readonly mapWalletFn: SettingsProps["mapWalletFn"];
  readonly mapWalletListFn: SettingsProps["mapWalletListFn"];
  readonly tonConnectManifestUrl: string | undefined;
  readonly variant: VariantProps["variant"];
};

export const defaultWidgetBootstrapConfig = {
  api: {
    apiKey: "",
    baseUrl: config.env.apiUrl,
    borrowApiUrl: config.env.borrowApiUrl,
    yieldsApiUrl: config.env.yieldsApiUrl,
  },
  tracking: {
    tracking: undefined,
    variant: "default",
  },
  wallet: {
    chainIconMapping: undefined,
    customConnectors: undefined,
    disableInjectedProviderDiscovery: true,
    externalProviderInitToken: null,
    forceWalletConnectOnly: false,
    hasExternalProvider: false,
    institutionalWallets: false,
    isLedgerLive: false,
    isSafe: false,
    mapWalletFn: undefined,
    mapWalletListFn: undefined,
    tonConnectManifestUrl: undefined,
    variant: "default",
  },
} as const;

export type WidgetBootstrapConfigValue = {
  readonly api: WidgetApiConfig;
  readonly tracking: WidgetTrackingConfig;
  readonly wallet: WidgetWalletConfig;
};

type WidgetConfigServiceValue = {
  readonly initial: WidgetConfig;
  readonly current: Effect.Effect<WidgetConfig>;
  readonly changes: Stream.Stream<WidgetConfig>;
};

export class WidgetConfigService extends Context.Service<
  WidgetConfigService,
  WidgetConfigServiceValue
>()("stakekit/widget/WidgetConfigService") {
  static layer(value: WidgetConfigServiceValue) {
    return Layer.succeed(WidgetConfigService, value);
  }
}
