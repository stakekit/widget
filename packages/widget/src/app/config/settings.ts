import { Record as EffectRecord } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { validateBorrowFeatureConfiguration } from "../../domain/borrow/availability";
import { normalizeDashboardYieldCategoryOrder } from "../../domain/earn/yield";
import type {
  PreferredTokenYieldsPerNetwork,
  SKAppProps,
} from "../../public-api/types";
import {
  defaultWidgetBootstrapConfig,
  type WidgetConfig,
} from "../../services/config/widget-config";
import { hasValidBorrowProviderContract } from "../../services/wallet/external-provider";
import { config } from "../../shared/config/widget-defaults";
import { selectAtom } from "../../shared/effect/select-atom";

type TokenYieldPreferences = Exclude<
  PreferredTokenYieldsPerNetwork[keyof PreferredTokenYieldsPerNetwork],
  undefined
>;

export const normalizeWidgetConfig = (
  input: SKAppProps,
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
  const borrowEnabled = input.borrowEnabled ?? false;
  const yieldGrouping =
    input.yieldGrouping ?? (input.dashboardVariant ? "category" : "flat");

  validateBorrowFeatureConfiguration({
    borrowEnabled,
    dashboardVariant: input.dashboardVariant,
    hasExternalProviderBorrowCapability:
      !input.externalProviders ||
      hasValidBorrowProviderContract(input.externalProviders),
    yieldGrouping,
  });

  return {
    ...input,
    borrowEnabled,
    dashboardYieldCategoryOrder: normalizeDashboardYieldCategoryOrder(
      input.dashboardYieldCategoryOrder
    ),
    isLedgerLive: options.isLedgerLive ?? false,
    preferredTokenYieldsPerNetwork,
    wagmi,
    yieldGrouping,
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
