import {
  Context,
  Effect,
  Equal,
  Layer,
  Ref,
  Result,
  Semaphore,
  Stream,
  SubscriptionRef,
} from "effect";
import type { YieldCategory } from "../../domain/earn/contract";
import { validatorAddressIdentities } from "../../domain/earn/validator";
import {
  type ValidatorsConfig,
  yieldCategories,
} from "../../domain/earn/yield";
import type { Network } from "../../domain/network/network";
import type { SKHostConfiguration } from "../../public-api/react-types";
import { config } from "../../shared/config/widget-defaults";
import type { ExternalProviderSnapshot } from "./external-provider-snapshot";
import { type HostProfile, resolveHostProfile } from "./host-profile";
import {
  type DecodedHostConfiguration,
  decodeHostConfiguration,
  type HostConfigurationWarning,
  type InvalidHostConfiguration,
  type MountFixedHostSettings,
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
  readonly hostTracking: HostProfile["hostTracking"];
  readonly tracking: WidgetConfig["tracking"];
};

type WidgetWalletSnapshot = {
  readonly chainIconMapping: WidgetConfig["chainIconMapping"];
  readonly disableInjectedProviderDiscovery: boolean;
  readonly externalProviderInitToken: ExternalProviderSnapshot["initToken"];
  readonly hasExternalProvider: boolean;
  readonly institutionalWallets: boolean;
  readonly isLedgerLive: boolean;
  readonly isSafe: boolean;
  readonly mapWalletFn: WidgetConfig["mapWalletFn"];
  readonly tonConnectManifestUrl: string | undefined;
  readonly walletCatalogue: HostProfile["walletCatalogue"];
  readonly walletPolicy: WidgetConfig["walletPolicy"];
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
    hostTracking: settings.hostProfile.hostTracking,
    tracking: settings.tracking,
  },
  wallet: {
    chainIconMapping: settings.chainIconMapping,
    disableInjectedProviderDiscovery: settings.disableInjectedProviderDiscovery,
    externalProviderInitToken: settings.externalProviders?.initToken,
    hasExternalProvider: settings.externalProviders !== undefined,
    institutionalWallets:
      settings.institutionalWallets ||
      settings.hostProfile.forcesInstitutionalWallets,
    isLedgerLive: settings.isLedgerLive,
    isSafe: settings.isSafe,
    mapWalletFn: settings.mapWalletFn,
    tonConnectManifestUrl: settings.tonConnectManifestUrl,
    walletCatalogue: settings.hostProfile.walletCatalogue,
    walletPolicy: settings.walletPolicy,
  },
});

const walletSnapshotKeys = [
  "chainIconMapping",
  "disableInjectedProviderDiscovery",
  "externalProviderInitToken",
  "hasExternalProvider",
  "institutionalWallets",
  "isLedgerLive",
  "isSafe",
  "mapWalletFn",
  "tonConnectManifestUrl",
  "walletCatalogue",
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

/**
 * Widget Configuration fields the Application Runtime Generation reads once at
 * mount (ADR 0004). Updates keep their mount values.
 */
const mountFixedKeys = [
  "apiKey",
  "baseUrl",
  "borrowApiUrl",
  "borrowEnabled",
  "yieldsApiUrl",
] as const satisfies ReadonlyArray<
  keyof WidgetConfig & keyof MountFixedHostSettings
>;

type MountFixedKey = (typeof mountFixedKeys)[number];

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
  const variant = hostConfiguration.variant ?? "default";
  const yieldGrouping =
    hostConfiguration.yieldGrouping ?? (dashboardVariant ? "category" : "flat");

  const yieldCategoryOrder = [
    ...new Set([
      ...(hostConfiguration.yieldCategoryOrder ?? []),
      ...yieldCategories,
    ]),
  ] as YieldCategory[];
  const validatorsConfig: ValidatorsConfig = new Map(
    Object.entries(hostConfiguration.validatorsConfig ?? {}).map(
      ([network, validators]) =>
        [
          network as Network | "*",
          {
            allowed: validators.allowed
              ? new Set(validatorAddressIdentities(validators.allowed))
              : undefined,
            blocked: validators.blocked
              ? new Set(validatorAddressIdentities(validators.blocked))
              : undefined,
            mergePreferredWithDefault:
              validators.mergePreferredWithDefault ?? true,
            preferred: validators.preferred
              ? new Set(validatorAddressIdentities(validators.preferred))
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
    borrowMarketsScope: hostConfiguration.borrowMarketsScope ?? "all",
    chainIconMapping: hostConfiguration.chainIconMapping,
    chainModal:
      hostConfiguration.variant === "zerion"
        ? hostConfiguration.chainModal
        : undefined,
    customTranslations: hostConfiguration.customTranslations,
    dashboardVariant,
    yieldCategoryOrder,
    disableAutoScrollToTop: hostConfiguration.disableAutoScrollToTop ?? false,
    disableInitLayoutAnimation:
      hostConfiguration.disableInitLayoutAnimation ?? false,
    disableInjectedProviderDiscovery:
      hostConfiguration.disableInjectedProviderDiscovery ?? false,
    disableResizingInputFontSize:
      hostConfiguration.disableResizingInputFontSize ?? false,
    externalProviders,
    hideAccountAndChainSelector:
      hostConfiguration.hideAccountAndChainSelector ?? false,
    hideChainSelector: hostConfiguration.hideChainSelector ?? false,
    hideGasFee: hostConfiguration.hideGasFee ?? false,
    hideNetworkLogo: hostConfiguration.hideNetworkLogo ?? false,
    hostProfile: resolveHostProfile(variant, dashboardVariant),
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
    preferredTokenYieldsPerNetwork:
      hostConfiguration.preferredTokenYieldsPerNetwork,
    theme: hostConfiguration.theme,
    tokenIconMapping: hostConfiguration.tokenIconMapping,
    tonConnectManifestUrl: hostConfiguration.tonConnectManifestUrl,
    tracking: hostConfiguration.tracking,
    validatorsConfig,
    variant,
    walletPolicy: hostConfiguration.walletPolicy,
    yieldGrouping,
    yieldProviderOrder: hostConfiguration.yieldProviderOrder ?? {},
    yieldsApiUrl: hostConfiguration.yieldsApiUrl ?? environment.yieldsApiUrl,
  };
};

const prepareWidgetConfig = (
  hostConfiguration: SKHostConfiguration,
  environment: WidgetConfigEnvironment,
  mountFixed?: MountFixedHostSettings
): Result.Result<NormalizedWidgetConfiguration, InvalidHostConfiguration> => {
  const decoded = decodeHostConfiguration(hostConfiguration, mountFixed);
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
        const reportedMountFixedKeys = yield* Ref.make<
          ReadonlyArray<MountFixedKey>
        >([]);
        const reportIgnoredMountFixedKeys = Effect.fn(
          "WidgetConfigService.reportIgnoredMountFixedKeys"
        )(function* (keys: ReadonlyArray<MountFixedKey>) {
          const reported = yield* Ref.get(reportedMountFixedKeys);
          const fresh = keys.filter((key) => !reported.includes(key));
          if (fresh.length === 0) return;

          yield* Ref.set(reportedMountFixedKeys, [...reported, ...fresh]);
          yield* Effect.logWarning(
            "Mount-fixed Widget Configuration changed after mount and was ignored"
          ).pipe(
            Effect.annotateLogs({
              event: "mount_fixed_configuration_changed",
              keys: fresh,
            })
          );
        });
        const rejectInvalid = Effect.fn("WidgetConfigService.rejectInvalid")(
          function* (error: InvalidHostConfiguration) {
            yield* Effect.logWarning(
              "Widget Configuration update rejected"
            ).pipe(
              Effect.annotateLogs({
                issuePaths: error.issuePaths,
                event: "invalid_widget_configuration_update",
                issues: error.issues,
              })
            );
            return { _tag: "RejectedInvalid", error } as const;
          }
        );
        const update = Effect.fn("WidgetConfigService.update")(function* (
          hostConfiguration: SKHostConfiguration
        ) {
          const requested = prepareWidgetConfig(hostConfiguration, environment);
          if (Result.isFailure(requested)) {
            return yield* rejectInvalid(requested.failure);
          }

          const changed = mountFixedKeys.filter(
            (key) => !Equal.equals(requested.success.config[key], initial[key])
          );
          // Re-run the decode with the mount values so cross-field rules such
          // as Borrow requiring the dashboard hold for the published value.
          const nextResult =
            changed.length === 0
              ? requested
              : prepareWidgetConfig(hostConfiguration, environment, {
                  apiKey: initialHostConfiguration.apiKey,
                  baseUrl: initialHostConfiguration.baseUrl,
                  borrowApiUrl: initialHostConfiguration.borrowApiUrl,
                  borrowEnabled: initialHostConfiguration.borrowEnabled,
                  yieldsApiUrl: initialHostConfiguration.yieldsApiUrl,
                });
          if (Result.isFailure(nextResult)) {
            return yield* rejectInvalid(nextResult.failure);
          }

          yield* reportIgnoredMountFixedKeys(changed);
          yield* logHostConfigurationWarnings(nextResult.success.warnings);
          yield* SubscriptionRef.set(state, nextResult.success.config);
          return { _tag: "Updated" } as const;
        }, updatePermit.withPermit);

        return WidgetConfigService.of({ current, update, values });
      })
    );
  }
}
