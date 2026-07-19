import { Record as EffectRecord } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { normalizeDashboardYieldCategoryOrder } from "../../domain/types/yields";
import type {
  PreferredTokenYieldsPerNetwork,
  SettingsProps,
  VariantProps,
} from "../../public-api/types";
import {
  defaultWidgetBootstrapConfig,
  type WidgetConfig,
} from "../../services/config/widget-config";
import { config } from "../../shared/config/widget-defaults";
import { selectAtom } from "../../shared/effect/select-atom";

type TokenYieldPreferences = Exclude<
  PreferredTokenYieldsPerNetwork[keyof PreferredTokenYieldsPerNetwork],
  undefined
>;

export const normalizeWidgetConfig = (
  input: SettingsProps & VariantProps,
  options: { readonly isLedgerLive?: boolean } = {}
): WidgetConfig => {
  const preferredTokenYieldsPerNetwork = input.preferredTokenYieldsPerNetwork
    ? (EffectRecord.map(
        input.preferredTokenYieldsPerNetwork as Readonly<
          Record<string, TokenYieldPreferences>
        >,
        (tokenYields) =>
          EffectRecord.mapKeys(
            tokenYields as Readonly<
              Record<string, TokenYieldPreferences[keyof TokenYieldPreferences]>
            >,
            (tokenString) => tokenString.toLowerCase()
          )
      ) as PreferredTokenYieldsPerNetwork)
    : undefined;

  const wagmi =
    !config.env.isTestMode && input.wagmi?.__customConnectors__
      ? { ...input.wagmi, __customConnectors__: undefined }
      : input.wagmi;

  return {
    ...input,
    borrowEnabled: input.borrowEnabled ?? false,
    dashboardYieldCategoryOrder: normalizeDashboardYieldCategoryOrder(
      input.dashboardYieldCategoryOrder
    ),
    isLedgerLive: options.isLedgerLive ?? false,
    preferredTokenYieldsPerNetwork,
    wagmi,
    yieldGrouping:
      input.yieldGrouping ?? (input.dashboardVariant ? "category" : "flat"),
  } as WidgetConfig;
};

const defaultWidgetConfig = normalizeWidgetConfig({
  apiKey: defaultWidgetBootstrapConfig.api.apiKey,
  baseUrl: defaultWidgetBootstrapConfig.api.baseUrl,
  borrowApiUrl: defaultWidgetBootstrapConfig.api.borrowApiUrl,
  disableInjectedProviderDiscovery:
    defaultWidgetBootstrapConfig.wallet.disableInjectedProviderDiscovery,
  variant: "default",
  yieldsApiUrl: defaultWidgetBootstrapConfig.api.yieldsApiUrl,
});

export const widgetConfigAtom = Atom.make<WidgetConfig>(
  defaultWidgetConfig
).pipe(Atom.keepAlive, Atom.withLabel("widgetConfigAtom"));

export const widgetConfigFieldAtom = Atom.family((field: keyof WidgetConfig) =>
  selectAtom(widgetConfigAtom, (settings) => settings[field])
);
