import { Context, Effect, Layer } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { config } from "../../config";
import type { SKExternalProviders } from "../../domain/types/wallets";
import type { SettingsContextType } from "../settings/types";

type WagmiSettings = NonNullable<SettingsContextType["wagmi"]>;

export type WidgetApiConfig = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly borrowApiUrl: string;
  readonly yieldsApiUrl: string;
};

type WidgetTrackingConfig = Pick<SettingsContextType, "tracking" | "variant">;

type WidgetWalletConfig = {
  readonly chainIconMapping: SettingsContextType["chainIconMapping"];
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
  readonly mapWalletFn: SettingsContextType["mapWalletFn"];
  readonly mapWalletListFn: SettingsContextType["mapWalletListFn"];
  readonly tonConnectManifestUrl: string | undefined;
  readonly variant: SettingsContextType["variant"];
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

export const normalizeWidgetBootstrapConfig = ({
  isLedgerLive,
  settings,
}: {
  readonly isLedgerLive: boolean;
  readonly settings: SettingsContextType;
}): WidgetBootstrapConfigValue => ({
  api: {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl ?? config.env.apiUrl,
    borrowApiUrl: settings.borrowApiUrl ?? config.env.borrowApiUrl,
    yieldsApiUrl: settings.yieldsApiUrl ?? config.env.yieldsApiUrl,
  },
  tracking: {
    tracking: settings.tracking,
    variant: settings.variant,
  },
  wallet: {
    chainIconMapping: settings.chainIconMapping,
    customConnectors: settings.wagmi?.__customConnectors__,
    disableInjectedProviderDiscovery:
      !!settings.disableInjectedProviderDiscovery,
    externalProviderInitToken: settings.externalProviders?.initToken ?? null,
    forceWalletConnectOnly: !!settings.wagmi?.forceWalletConnectOnly,
    hasExternalProvider: settings.externalProviders !== undefined,
    institutionalWallets: !!settings.institutionalWallets,
    isLedgerLive,
    isSafe: !!settings.isSafe,
    mapWalletFn: settings.mapWalletFn,
    mapWalletListFn: settings.mapWalletListFn,
    tonConnectManifestUrl: settings.tonConnectManifestUrl,
    variant: settings.variant,
  },
});

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

export const widgetBootstrapConfigAtom = Atom.make<WidgetBootstrapConfigValue>(
  defaultWidgetBootstrapConfig
).pipe(Atom.keepAlive, Atom.withLabel("widgetBootstrapConfigAtom"));
