import * as Atom from "effect/unstable/reactivity/Atom";
import {
  normalizeWidgetApiConfig,
  type WidgetBootstrapConfigValue,
} from "../../services/config/widget-config";
import { type WidgetConfig, widgetConfigAtom } from "./settings";

export { normalizeWidgetApiConfig };

export const normalizeWidgetBootstrapConfig = ({
  isLedgerLive,
  settings,
}: {
  readonly isLedgerLive: boolean;
  readonly settings: WidgetConfig;
}): WidgetBootstrapConfigValue => ({
  api: normalizeWidgetApiConfig(settings),
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

export const widgetBootstrapConfigAtom = Atom.make((get) => {
  const settings = get(widgetConfigAtom);

  return normalizeWidgetBootstrapConfig({
    isLedgerLive: settings.isLedgerLive,
    settings,
  });
}).pipe(Atom.keepAlive, Atom.withLabel("widgetBootstrapConfigAtom"));
