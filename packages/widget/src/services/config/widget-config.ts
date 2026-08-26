import {
  Context,
  Effect,
  Equal,
  Layer,
  Result,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import { validatorAddressIdentities } from "../../domain/earn/validator";
import {
  dashboardYieldCategories,
  type ValidatorsConfig,
} from "../../domain/earn/yield";
import type { Network } from "../../domain/network/network";
import type { ExternalProviderSnapshot } from "../../public-api/external-provider-contract";
import type {
  SKHostConfiguration,
  VariantProps,
} from "../../public-api/react-types";
import type {
  DashboardYieldCategory,
  PreferredTokenYieldsPerNetwork,
  SettingsProps,
} from "../../public-api/types";
import { config } from "../../shared/config/widget-defaults";
import {
  type DecodedHostConfiguration,
  decodeHostConfiguration,
  type HostConfigurationWarning,
  type InvalidHostConfiguration,
} from "./widget-config-boundary";
import type { WidgetConfig } from "./widget-config-model";

type WidgetConfigEnvironment = Readonly<{
  apiUrl: string;
  borrowApiUrl: string;
  isLedgerLive: boolean;
  mountAnimationStartsFinishedByDefault: boolean;
  yieldsApiUrl: string;
}>;

export type ApplicationApiIdentity = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly borrowApiUrl: string;
  readonly yieldsApiUrl: string;
};

type WidgetTrackingSnapshot = {
  readonly tracking: SettingsProps["tracking"];
  readonly variant: VariantProps["variant"];
};

type WidgetWalletSnapshot = {
  readonly chainIconMapping: SettingsProps["chainIconMapping"];
  readonly disableInjectedProviderDiscovery: boolean;
  readonly externalProviderInitToken: ExternalProviderSnapshot["initToken"];
  readonly hasExternalProvider: boolean;
  readonly forceWalletConnectOnly: boolean;
  readonly institutionalWallets: boolean;
  readonly isLedgerLive: boolean;
  readonly isSafe: boolean;
  readonly mapWalletFn: SettingsProps["mapWalletFn"];
  readonly tonConnectManifestUrl: string | undefined;
  readonly variant: VariantProps["variant"];
  readonly walletPolicy: SettingsProps["walletPolicy"];
};

export type WidgetBootstrapSnapshot = {
  readonly api: ApplicationApiIdentity;
  readonly tracking: WidgetTrackingSnapshot;
  readonly wallet: WidgetWalletSnapshot;
};

export const selectWidgetBootstrapSnapshot = (
  settings: WidgetConfig
): WidgetBootstrapSnapshot => ({
  api: {
    apiKey: settings.apiKey,
    baseUrl: settings.baseUrl,
    borrowApiUrl: settings.borrowApiUrl,
    yieldsApiUrl: settings.yieldsApiUrl,
  },
  tracking: {
    tracking: settings.tracking,
    variant: settings.variant,
  },
  wallet: {
    chainIconMapping: settings.chainIconMapping,
    disableInjectedProviderDiscovery: settings.disableInjectedProviderDiscovery,
    externalProviderInitToken: settings.externalProviders?.initToken,
    forceWalletConnectOnly: settings.forceWalletConnectOnly,
    hasExternalProvider: settings.externalProviders !== undefined,
    institutionalWallets: settings.institutionalWallets,
    isLedgerLive: settings.isLedgerLive,
    isSafe: settings.isSafe,
    mapWalletFn: settings.mapWalletFn,
    tonConnectManifestUrl: settings.tonConnectManifestUrl,
    variant: settings.variant,
    walletPolicy: settings.walletPolicy,
  },
});

const walletSnapshotKeys = [
  "chainIconMapping",
  "disableInjectedProviderDiscovery",
  "externalProviderInitToken",
  "forceWalletConnectOnly",
  "hasExternalProvider",
  "institutionalWallets",
  "isLedgerLive",
  "isSafe",
  "mapWalletFn",
  "tonConnectManifestUrl",
  "variant",
  "walletPolicy",
] as const satisfies ReadonlyArray<keyof WidgetWalletSnapshot>;

type WalletConfigDifference = {
  readonly material: ReadonlyArray<keyof WidgetWalletSnapshot>;
  readonly opaque: ReadonlyArray<keyof WidgetWalletSnapshot>;
};

export const diffWidgetWalletConfig = (
  next: WidgetWalletSnapshot,
  bootstrapped: WidgetWalletSnapshot
): WalletConfigDifference => {
  const isOpaque = (key: keyof WidgetWalletSnapshot) =>
    typeof next[key] === "function" || typeof bootstrapped[key] === "function";
  const changed = walletSnapshotKeys.filter(
    (key) => !Equal.equals(next[key], bootstrapped[key])
  );

  return {
    material: changed.filter((key) => !isOpaque(key)),
    opaque: changed.filter(isOpaque),
  };
};

type WidgetConfigUpdateOutcome =
  | Readonly<{
      readonly _tag: "RejectedInvalid";
      readonly error: InvalidHostConfiguration;
    }>
  | Readonly<{ readonly _tag: "Updated" }>;

type WidgetConfigServiceValue = {
  readonly current: Effect.Effect<WidgetConfig>;
  readonly update: (
    hostConfiguration: SKHostConfiguration
  ) => Effect.Effect<WidgetConfigUpdateOutcome>;
  readonly values: Stream.Stream<WidgetConfig>;
};

type NormalizedWidgetConfiguration = Readonly<{
  config: WidgetConfig;
  warnings: ReadonlyArray<HostConfigurationWarning>;
}>;

const normalizeWidgetConfig = (
  hostConfiguration: DecodedHostConfiguration,
  environment: WidgetConfigEnvironment
): WidgetConfig => {
  const borrowEnabled = hostConfiguration.borrowEnabled ?? false;
  const dashboardVariant = hostConfiguration.dashboardVariant ?? false;
  const yieldGrouping =
    hostConfiguration.yieldGrouping ?? (dashboardVariant ? "category" : "flat");

  const dashboardYieldCategoryOrder = [
    ...new Set([
      ...(hostConfiguration.dashboardYieldCategoryOrder ?? []),
      ...dashboardYieldCategories,
    ]),
  ] as DashboardYieldCategory[];
  const preferredTokenYieldsPerNetwork =
    hostConfiguration.preferredTokenYieldsPerNetwork
      ? (Object.fromEntries(
          Object.entries(hostConfiguration.preferredTokenYieldsPerNetwork).map(
            ([network, preferences]) => [
              network,
              Object.fromEntries(
                Object.entries(preferences).map(([token, yieldId]) => [
                  token.toLowerCase(),
                  yieldId,
                ])
              ),
            ]
          )
        ) as PreferredTokenYieldsPerNetwork)
      : undefined;
  const validatorsConfig: ValidatorsConfig = new Map(
    Object.entries(hostConfiguration.validatorsConfig ?? {}).map(
      ([network, validators]) =>
        [
          network as Network | "*",
          {
            allowed: validators.allowed
              ? new Set(validatorAddressIdentities(network, validators.allowed))
              : undefined,
            blocked: validators.blocked
              ? new Set(validatorAddressIdentities(network, validators.blocked))
              : undefined,
            mergePreferredWithDefault:
              validators.mergePreferredWithDefault ?? true,
            preferred: validators.preferred
              ? new Set(
                  validatorAddressIdentities(network, validators.preferred)
                )
              : undefined,
            preferredOnly: validators.preferredOnly ?? false,
          },
        ] as const
    )
  );
  const externalProviders = hostConfiguration.externalProviders
    ? {
        ...hostConfiguration.externalProviders,
        supportedChainIds: hostConfiguration.externalProviders.supportedChainIds
          ? [
              ...new Set(hostConfiguration.externalProviders.supportedChainIds),
            ].sort((first, second) => first - second)
          : undefined,
      }
    : undefined;
  return {
    apiKey: hostConfiguration.apiKey,
    baseUrl: hostConfiguration.baseUrl ?? environment.apiUrl,
    borrowApiUrl: (hostConfiguration.borrowApiUrl ?? environment.borrowApiUrl)
      .trim()
      .replace(/\/+$/, ""),
    borrowEnabled,
    chainIconMapping: hostConfiguration.chainIconMapping,
    chainModal:
      hostConfiguration.variant === "zerion"
        ? hostConfiguration.chainModal
        : undefined,
    customTranslations: hostConfiguration.customTranslations,
    dashboardVariant,
    dashboardYieldCategoryOrder,
    disableAutoScrollToTop: hostConfiguration.disableAutoScrollToTop ?? false,
    disableInitLayoutAnimation:
      hostConfiguration.disableInitLayoutAnimation ?? false,
    disableInjectedProviderDiscovery:
      hostConfiguration.disableInjectedProviderDiscovery ?? false,
    disableResizingInputFontSize:
      hostConfiguration.disableResizingInputFontSize ?? false,
    externalProviders,
    forceWalletConnectOnly: hostConfiguration.forceWalletConnectOnly ?? false,
    hideAccountAndChainSelector:
      hostConfiguration.hideAccountAndChainSelector ?? false,
    hideChainSelector: hostConfiguration.hideChainSelector ?? false,
    hideNetworkLogo: hostConfiguration.hideNetworkLogo ?? false,
    initialChain: hostConfiguration.initialChain,
    institutionalWallets: hostConfiguration.institutionalWallets ?? false,
    isLedgerLive: environment.isLedgerLive,
    isSafe: hostConfiguration.isSafe ?? false,
    language: hostConfiguration.language,
    mapWalletFn: hostConfiguration.mapWalletFn,
    mountAnimationStartsFinished:
      dashboardVariant ||
      (hostConfiguration.disableInitLayoutAnimation === undefined &&
        environment.mountAnimationStartsFinishedByDefault),
    onMountAnimationComplete: hostConfiguration.onMountAnimationComplete,
    portalContainer: hostConfiguration.portalContainer,
    preferredTokenYieldsPerNetwork,
    theme: hostConfiguration.theme,
    tokenIconMapping: hostConfiguration.tokenIconMapping,
    tonConnectManifestUrl: hostConfiguration.tonConnectManifestUrl,
    tracking: hostConfiguration.tracking,
    validatorsConfig,
    variant: hostConfiguration.variant ?? "default",
    walletPolicy: hostConfiguration.walletPolicy,
    yieldGrouping,
    yieldsApiUrl: hostConfiguration.yieldsApiUrl ?? environment.yieldsApiUrl,
  };
};

const prepareWidgetConfig = (
  hostConfiguration: SKHostConfiguration,
  environment: WidgetConfigEnvironment
): Result.Result<NormalizedWidgetConfiguration, InvalidHostConfiguration> => {
  const decoded = decodeHostConfiguration(hostConfiguration);
  if (Result.isFailure(decoded)) return Result.fail(decoded.failure);

  return Result.succeed({
    config: normalizeWidgetConfig(decoded.success.configuration, environment),
    warnings: decoded.success.warnings,
  });
};

const logHostConfigurationWarnings = (
  warnings: ReadonlyArray<HostConfigurationWarning>
) =>
  warnings.length === 0
    ? Effect.void
    : Effect.logWarning("Invalid Host Configuration values ignored").pipe(
        Effect.annotateLogs({
          event: "invalid_widget_configuration_warning",
          warnings,
        })
      );

export class WidgetConfigService extends Context.Service<
  WidgetConfigService,
  WidgetConfigServiceValue
>()("stakekit/widget/WidgetConfigService") {
  static layer(
    initialHostConfiguration: SKHostConfiguration,
    options: { readonly isLedgerLive?: boolean } = {}
  ) {
    return Layer.effect(
      WidgetConfigService,
      Effect.gen(function* () {
        const environment = {
          apiUrl: config.env.apiUrl,
          borrowApiUrl: config.env.borrowApiUrl,
          isLedgerLive: options.isLedgerLive ?? false,
          mountAnimationStartsFinishedByDefault: config.env.isTestMode,
          yieldsApiUrl: config.env.yieldsApiUrl,
        } satisfies WidgetConfigEnvironment;
        const initialResult = prepareWidgetConfig(
          initialHostConfiguration,
          environment
        );
        if (Result.isFailure(initialResult)) {
          yield* Effect.logError(
            "Initial Widget Configuration is invalid"
          ).pipe(
            Effect.annotateLogs({
              issuePaths: initialResult.failure.issuePaths,
              event: "invalid_initial_widget_configuration",
              issues: initialResult.failure.issues,
            })
          );
          return yield* initialResult.failure;
        }

        yield* logHostConfigurationWarnings(initialResult.success.warnings);
        const initial = initialResult.success.config;
        const state = yield* SubscriptionRef.make(initial);
        const updatePermit = yield* Semaphore.make(1);
        const current: WidgetConfigServiceValue["current"] =
          SubscriptionRef.get(state);
        const values: WidgetConfigServiceValue["values"] =
          SubscriptionRef.changes(state).pipe(
            Stream.changesWith((previous, next) => Equal.equals(previous, next))
          );
        const update = Effect.fn("WidgetConfigService.update")(function* (
          hostConfiguration: SKHostConfiguration
        ) {
          const nextResult = prepareWidgetConfig(
            hostConfiguration,
            environment
          );
          if (Result.isFailure(nextResult)) {
            yield* Effect.logWarning(
              "Widget Configuration update rejected"
            ).pipe(
              Effect.annotateLogs({
                issuePaths: nextResult.failure.issuePaths,
                event: "invalid_widget_configuration_update",
                issues: nextResult.failure.issues,
              })
            );
            return {
              _tag: "RejectedInvalid",
              error: nextResult.failure,
            } as const;
          }

          yield* logHostConfigurationWarnings(nextResult.success.warnings);
          yield* SubscriptionRef.set(state, nextResult.success.config);
          return { _tag: "Updated" } as const;
        }, updatePermit.withPermit);

        return WidgetConfigService.of({ current, update, values });
      })
    );
  }
}
