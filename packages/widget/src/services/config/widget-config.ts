import { Context, Effect, Layer } from "effect";
import type { SKExternalProviders } from "../../domain/types/wallets";
import type { SettingsProps, VariantProps } from "../../public-api/types";
import { config } from "../../shared/config/widget-defaults";

type WagmiSettings = NonNullable<SettingsProps["wagmi"]>;

export type WidgetApiConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly borrowApiUrl: string;
  readonly yieldsApiUrl: string;
};

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

export class WidgetBootstrapConfig extends Context.Service<WidgetBootstrapConfig>()(
  "stakekit/widget/WidgetBootstrapConfig",
  {
    make: (value: WidgetBootstrapConfigValue) => Effect.succeed(value),
  }
) {
  static layer(value: WidgetBootstrapConfigValue) {
    return Layer.effect(
      WidgetBootstrapConfig,
      WidgetBootstrapConfig.make(value)
    );
  }
}
