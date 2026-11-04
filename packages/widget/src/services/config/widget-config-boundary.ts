import {
  Data,
  Option,
  Predicate,
  Result,
  Schema,
  SchemaGetter,
  SchemaIssue,
} from "effect";
import { YieldCategory } from "../../domain/earn/contract";
import type { PreferredTokenYieldsPerNetwork } from "../../domain/earn/yield";
import type { YieldProviderOrder } from "../../domain/earn/yield-provider-order";
import { ProviderId, YieldId } from "../../domain/identity/identifiers";
import { Network } from "../../domain/network/network";
import { HostTokenKey } from "../../domain/token/token";
import {
  EvmChainIds,
  MiscChainIds,
  SubstrateChainIds,
  type SupportedSKChainIds,
} from "../../domain/wallet/chain-ids";
import type {
  SKHostConfiguration,
  VariantProps,
} from "../../public-api/react-types";
import type { SKTheme } from "../../public-api/theme";
import type {
  SettingsProps,
  SKBorrowExternalProviders,
  SKExternalProviders,
} from "../../public-api/types";
import type { ExternalProviderSnapshot } from "./external-provider-snapshot";
import { decodeTheme, type ThemeDecodeWarning } from "./theme-decoder";
import type { WidgetLayout } from "./widget-config-model";

// Hosts may pass `undefined` for any optional setting; decoding normalizes it
// to an absent key so consumers see a single "not set" representation.
const optional = <S extends Schema.Top>(schema: S) =>
  Schema.optionalKey(Schema.UndefinedOr(schema)).pipe(
    Schema.decodeTo(Schema.optionalKey(Schema.toType(schema)), {
      decode: SchemaGetter.transformOptional(
        Option.filter(Predicate.isNotUndefined)
      ),
      encode: SchemaGetter.passthroughSubtype(),
    })
  );

const exhaustiveLiterals =
  <All extends number | string>() =>
  <const Values extends ReadonlyArray<All>>(
    values: Exclude<All, Values[number]> extends never ? Values : never
  ) =>
    values;

const supportedChainIds = exhaustiveLiterals<SupportedSKChainIds>()([
  EvmChainIds.Ethereum,
  EvmChainIds.Polygon,
  EvmChainIds.Optimism,
  EvmChainIds.Arbitrum,
  EvmChainIds.AvalancheC,
  EvmChainIds.Celo,
  EvmChainIds.Harmony,
  EvmChainIds.Viction,
  EvmChainIds.Binance,
  EvmChainIds.Base,
  EvmChainIds.Linea,
  EvmChainIds.Core,
  EvmChainIds.Sonic,
  EvmChainIds.EthereumHoodi,
  EvmChainIds.EthereumGoerli,
  EvmChainIds.EthereumSepolia,
  EvmChainIds.Unichain,
  EvmChainIds.Katana,
  EvmChainIds.Gnosis,
  EvmChainIds.Hyperevm,
  EvmChainIds.Plasma,
  EvmChainIds.Monad,
  EvmChainIds.MonadTestnet,
  EvmChainIds.Robinhood,
  EvmChainIds.RobinhoodTestnet,
  EvmChainIds.Pharos,
  SubstrateChainIds.Polkadot,
  SubstrateChainIds.Bittensor,
  MiscChainIds.Near,
  MiscChainIds.Tezos,
  MiscChainIds.Solana,
  MiscChainIds.Tron,
  MiscChainIds.Ton,
  MiscChainIds.Cardano,
]);

const SupportedChainId = Schema.Literals(supportedChainIds);

type HostLanguage = NonNullable<SettingsProps["language"]>;
type HostVariant = NonNullable<SKHostConfiguration["variant"]>;
type HostYieldGrouping = NonNullable<SettingsProps["yieldGrouping"]>;

const yieldCategoryValues = exhaustiveLiterals<YieldCategory>()([
  YieldCategory.RWA,
  YieldCategory.DeFi,
  YieldCategory.Stake,
]);
const hostLanguageValues = exhaustiveLiterals<HostLanguage>()(["en", "fr"]);
const hostVariantValues = exhaustiveLiterals<HostVariant>()([
  "default",
  "finery",
  "porto",
  "utila",
  "zerion",
]);
const hostYieldGroupingValues = exhaustiveLiterals<HostYieldGrouping>()([
  "flat",
  "category",
]);
const borrowMarketsScopeValues = exhaustiveLiterals<
  NonNullable<SettingsProps["borrowMarketsScope"]>
>()(["all", "enabled"]);

interface TranslationTree {
  readonly [key: string]: string | TranslationTree;
}

const TranslationTree: Schema.Codec<TranslationTree> = Schema.Record(
  Schema.String,
  Schema.Union([
    Schema.String,
    Schema.suspend((): Schema.Codec<TranslationTree> => TranslationTree),
  ])
);

const customTranslationFields = {
  en: optional(Schema.Struct({ translation: TranslationTree })),
  fr: optional(Schema.Struct({ translation: TranslationTree })),
} satisfies Record<HostLanguage, Schema.Constraint>;

const CustomTranslations = Schema.Struct(customTranslationFields);

type ValidatorPolicySettings = NonNullable<
  NonNullable<SettingsProps["validatorsConfig"]>["*"]
>;

const validatorPolicyFields = {
  allowed: optional(Schema.Array(Schema.String)),
  blocked: optional(Schema.Array(Schema.String)),
  mergePreferredWithDefault: optional(Schema.Boolean),
  preferred: optional(Schema.Array(Schema.String)),
  preferredOnly: optional(Schema.Boolean),
} satisfies Record<keyof ValidatorPolicySettings, Schema.Constraint>;

const ValidatorPolicy = Schema.Struct(validatorPolicyFields);

const IconMapping = Schema.Record(Schema.String, Schema.String);
// Fields recovered entry by entry: only their outer shape is decoded with the
// Host Configuration, so an invalid entry drops only itself.
const LooseRecord = Schema.Record(Schema.String, Schema.Unknown);
const PreferredYield = Schema.Union([Schema.Literal("*"), YieldId]);

type ExternalProviderSettings = NonNullable<SettingsProps["externalProviders"]>;
type ExternalProviderValueKey = Exclude<
  keyof ExternalProviderSettings,
  "provider"
>;
type ExternalProviderType = ExternalProviderSettings["type"];

const externalProviderTypeValues = exhaustiveLiterals<ExternalProviderType>()([
  "generic",
]);

const externalProviderValueFields = {
  currentAddress: Schema.String,
  currentChain: optional(SupportedChainId),
  initToken: optional(
    Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.String])
  ),
  supportedChainIds: optional(Schema.Array(SupportedChainId)),
  type: Schema.Literals(externalProviderTypeValues),
} satisfies Record<ExternalProviderValueKey, Schema.Constraint>;

const ExternalProviderValues = Schema.Struct(externalProviderValueFields);

const walletPolicyFields = {
  allow: optional(Schema.Array(Schema.String)),
  deny: optional(Schema.Array(Schema.String)),
  groupOrder: optional(Schema.Array(Schema.String)),
  groups: optional(Schema.Record(Schema.String, Schema.String)),
  order: optional(Schema.Array(Schema.String)),
} satisfies Record<
  keyof NonNullable<SettingsProps["walletPolicy"]>,
  Schema.Constraint
>;

const WalletPolicy = Schema.Struct(walletPolicyFields);

type OpaqueHostConfigurationKey =
  | "mapWalletFn"
  | "onMountAnimationComplete"
  | "portalContainer"
  | "tracking";
type HostConfigurationValueKey = Exclude<
  keyof SKHostConfiguration,
  OpaqueHostConfigurationKey
>;

const hostConfigurationValueFields = {
  apiKey: Schema.NonEmptyString,
  baseUrl: optional(Schema.String),
  borrowApiUrl: optional(Schema.String),
  borrowEnabled: optional(Schema.Boolean),
  borrowMarketsScope: optional(Schema.Literals(borrowMarketsScopeValues)),
  chainIconMapping: optional(LooseRecord),
  customTranslations: optional(CustomTranslations),
  dashboardVariant: optional(Schema.Boolean),
  yieldCategoryOrder: optional(
    Schema.Array(Schema.Literals(yieldCategoryValues))
  ),
  disableAutoScrollToTop: optional(Schema.Boolean),
  disableInitLayoutAnimation: optional(Schema.Boolean),
  disableInjectedProviderDiscovery: optional(Schema.Boolean),
  disableResizingInputFontSize: optional(Schema.Boolean),
  externalProviders: optional(ExternalProviderValues),
  hideAccountAndChainSelector: optional(Schema.Boolean),
  hideChainSelector: optional(Schema.Boolean),
  hideGasFee: optional(Schema.Boolean),
  hideNetworkLogo: optional(Schema.Boolean),
  initialChain: optional(SupportedChainId),
  institutionalWallets: optional(Schema.Boolean),
  isSafe: optional(Schema.Boolean),
  language: optional(Schema.Literals(hostLanguageValues)),
  preferredTokenYieldsPerNetwork: optional(LooseRecord),
  theme: optional(Schema.Unknown),
  tokenIconMapping: optional(IconMapping),
  tonConnectManifestUrl: optional(Schema.String),
  validatorsConfig: optional(LooseRecord),
  variant: optional(Schema.Literals(hostVariantValues)),
  walletPolicy: optional(WalletPolicy),
  yieldGrouping: optional(Schema.Literals(hostYieldGroupingValues)),
  yieldProviderOrder: optional(LooseRecord),
  yieldsApiUrl: optional(Schema.String),
} satisfies Record<HostConfigurationValueKey, Schema.Constraint>;

const HostConfigurationValues = Schema.Struct(hostConfigurationValueFields);

type HostConfigurationValueData = typeof HostConfigurationValues.Type;
type ChainModal = Extract<
  VariantProps,
  { readonly variant: "zerion" }
>["chainModal"];
type ChainIconMapper = Extract<
  NonNullable<SettingsProps["chainIconMapping"]>,
  (...args: never[]) => unknown
>;
type TokenIconMapper = Extract<
  NonNullable<SettingsProps["tokenIconMapping"]>,
  (...args: never[]) => unknown
>;

/**
 * Host settings fixed at mount (ADR 0004). A decode given them uses them in
 * place of the host's values, so cross-field rules hold for the published value.
 * Every key is present: an unset mount value (`undefined`) still overrides the
 * host's later value.
 */
export type MountFixedHostSettings = {
  readonly [Key in
    | "apiKey"
    | "baseUrl"
    | "borrowApiUrl"
    | "borrowEnabled"
    | "yieldsApiUrl"]: SKHostConfiguration[Key];
};

// Borrow follows `borrowEnabled`, which may be fixed at mount while the
// provider comes from a later update, so its settings are not narrowed here.
type ExternalProviderCapability = Readonly<{
  borrow: boolean;
  settings: SKExternalProviders | SKBorrowExternalProviders | undefined;
}>;

type HostCapabilities = Readonly<{
  chainIconMapper: ChainIconMapper | undefined;
  chainModal: ChainModal | undefined;
  externalProviders: ExternalProviderCapability;
  mapWalletFn: SettingsProps["mapWalletFn"];
  onMountAnimationComplete: SettingsProps["onMountAnimationComplete"];
  portalContainer: SettingsProps["portalContainer"];
  tokenIconMapper: TokenIconMapper | undefined;
  tracking: SettingsProps["tracking"];
}>;

/** Host Configuration fields keyed by network. */
type NetworkKeyedField =
  | "chainIconMapping"
  | "preferredTokenYieldsPerNetwork"
  | "validatorsConfig";

export type DecodedHostConfiguration = Omit<
  HostConfigurationValueData,
  | "chainModal"
  | "externalProviders"
  | "tokenIconMapping"
  | NetworkKeyedField
  | "theme"
  | "yieldProviderOrder"
> &
  Readonly<{
    chainIconMapping: SettingsProps["chainIconMapping"];
    chainModal: ChainModal | undefined;
    externalProviders: ExternalProviderSnapshot | undefined;
    mapWalletFn: SettingsProps["mapWalletFn"];
    onMountAnimationComplete: SettingsProps["onMountAnimationComplete"];
    portalContainer: SettingsProps["portalContainer"];
    preferredTokenYieldsPerNetwork: PreferredTokenYieldsPerNetwork | undefined;
    theme: SKTheme | undefined;
    tokenIconMapping: SettingsProps["tokenIconMapping"];
    tracking: SettingsProps["tracking"];
    validatorsConfig:
      | Partial<Record<Network | "*", typeof ValidatorPolicy.Type>>
      | undefined;
    yieldProviderOrder: YieldProviderOrder | undefined;
  }>;

export type InvalidHostConfigurationIssue =
  | "borrow-provider-capability-missing"
  | "borrow-requires-category-grouping"
  | "borrow-requires-dashboard"
  | "host-configuration-decode-failed"
  | "zerion-chain-modal-missing";

export class InvalidHostConfiguration extends Data.TaggedError(
  "InvalidHostConfiguration"
)<{
  readonly cause?: Schema.SchemaError;
  readonly issuePaths: ReadonlyArray<string>;
  readonly issues: ReadonlyArray<InvalidHostConfigurationIssue>;
}> {}

export type HostConfigurationWarning =
  | Readonly<{
      readonly _tag: "Theme";
      readonly issue: ThemeDecodeWarning;
    }>
  /** An entry under a key that names no network; only that entry is dropped. */
  | Readonly<{
      readonly _tag: "UnknownNetworkKey";
      readonly field: NetworkKeyedField;
      readonly key: string;
    }>
  /** A value that does not decode; only its entry is dropped. */
  | Readonly<{
      readonly _tag: "InvalidEntry";
      readonly field: NetworkKeyedField | "yieldProviderOrder";
      readonly path: string;
    }>;

export type HostConfigurationDecodeSuccess = Readonly<{
  configuration: DecodedHostConfiguration;
  warnings: ReadonlyArray<HostConfigurationWarning>;
}>;

const issuePaths = (error: Schema.SchemaError): ReadonlyArray<string> => [
  ...new Set(
    SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues.map(
      (issue) => issue.path?.map(String).join(".") ?? ""
    )
  ),
];

const isNetwork = Schema.is(Network);

const isNetworkOrAnyKey = (key: string): key is Network | "*" =>
  key === "*" || isNetwork(key);

type NetworkKeyedEntries<Key extends string, Value> = Readonly<{
  entries: Partial<Record<Key, Value>> | undefined;
  warnings: ReadonlyArray<HostConfigurationWarning>;
}>;

/**
 * Keeps the entries under a network key whose value decodes. An unknown key
 * is dropped before its value is read; each dropped entry is a warning.
 * `decodeValue` may add warnings for entries nested in a value it keeps.
 */
const keepNetworkEntries = <Key extends string, Value>(
  field: NetworkKeyedField,
  record: Readonly<Record<string, unknown>> | undefined,
  isKey: (key: string) => key is Key,
  decodeValue: (
    value: unknown,
    key: Key,
    warnings: Array<HostConfigurationWarning>
  ) => Option.Option<Value>
): NetworkKeyedEntries<Key, Value> => {
  if (record === undefined) return { entries: undefined, warnings: [] };
  const entries: Partial<Record<Key, Value>> = {};
  const warnings: Array<HostConfigurationWarning> = [];
  for (const [key, raw] of Object.entries(record)) {
    if (!isKey(key)) {
      warnings.push({ _tag: "UnknownNetworkKey", field, key });
      continue;
    }
    const value = decodeValue(raw, key, warnings);
    if (Option.isSome(value)) entries[key] = value.value;
    else warnings.push({ _tag: "InvalidEntry", field, path: key });
  }
  return { entries, warnings };
};

const decodeIconUrl = Schema.decodeUnknownOption(Schema.String);
const decodeValidatorPolicy = Schema.decodeUnknownOption(ValidatorPolicy);
const decodeHostTokenKey = Schema.decodeUnknownOption(HostTokenKey);
const decodePreferredYield = Schema.decodeUnknownOption(PreferredYield);
const decodeProviderId = Schema.decodeUnknownOption(ProviderId);

/** One network's preferred token yields that decode; each other is a warning. */
const decodePreferredYields = (
  tokens: unknown,
  network: Network,
  warnings: Array<HostConfigurationWarning>
): Option.Option<Partial<Record<HostTokenKey, YieldId | "*">>> => {
  if (!Predicate.isObject(tokens)) return Option.none();
  const kept: Partial<Record<HostTokenKey, YieldId | "*">> = {};
  for (const [token, yieldId] of Object.entries(tokens)) {
    const key = decodeHostTokenKey(token);
    const value = decodePreferredYield(yieldId);
    if (Option.isSome(key) && Option.isSome(value)) {
      kept[key.value] = value.value;
    } else {
      warnings.push({
        _tag: "InvalidEntry",
        field: "preferredTokenYieldsPerNetwork",
        path: `${network}.${token}`,
      });
    }
  }
  return Option.some(kept);
};

/** Keeps each category's provider IDs that decode; each other is a warning. */
const keepProviderIds = (
  order: HostConfigurationValueData["yieldProviderOrder"]
) => {
  if (order === undefined) return { order: undefined, warnings: [] };
  const warnings: Array<HostConfigurationWarning> = [];
  const kept: Partial<Record<YieldCategory, ReadonlyArray<ProviderId>>> = {};
  for (const category of yieldCategoryValues) {
    const providerIds = order[category];
    if (providerIds === undefined) continue;
    if (!Array.isArray(providerIds)) {
      warnings.push({
        _tag: "InvalidEntry",
        field: "yieldProviderOrder",
        path: category,
      });
      continue;
    }
    kept[category] = providerIds.flatMap((providerId: unknown, index) => {
      const decoded = decodeProviderId(providerId);
      if (Option.isSome(decoded)) return [decoded.value];
      warnings.push({
        _tag: "InvalidEntry",
        field: "yieldProviderOrder",
        path: `${category}.${index}`,
      });
      return [];
    });
  }
  return { order: kept, warnings };
};

const makeCapabilities = (
  hostConfiguration: SKHostConfiguration,
  borrowEnabled: boolean | undefined
): HostCapabilities => ({
  chainIconMapper:
    typeof hostConfiguration.chainIconMapping === "function"
      ? hostConfiguration.chainIconMapping
      : undefined,
  chainModal:
    hostConfiguration.variant === "zerion"
      ? hostConfiguration.chainModal
      : undefined,
  externalProviders: {
    borrow: borrowEnabled === true,
    settings: hostConfiguration.externalProviders,
  },
  mapWalletFn: hostConfiguration.mapWalletFn,
  onMountAnimationComplete: hostConfiguration.onMountAnimationComplete,
  portalContainer: hostConfiguration.portalContainer,
  tokenIconMapper:
    typeof hostConfiguration.tokenIconMapping === "function"
      ? hostConfiguration.tokenIconMapping
      : undefined,
  tracking: hostConfiguration.tracking,
});

const projectValues = (
  hostConfiguration: SKHostConfiguration,
  mountFixed: MountFixedHostSettings | undefined
): unknown => {
  if (typeof hostConfiguration !== "object" || hostConfiguration === null) {
    return hostConfiguration;
  }

  return {
    ...hostConfiguration,
    chainIconMapping:
      typeof hostConfiguration.chainIconMapping === "function"
        ? undefined
        : hostConfiguration.chainIconMapping,
    tokenIconMapping:
      typeof hostConfiguration.tokenIconMapping === "function"
        ? undefined
        : hostConfiguration.tokenIconMapping,
    ...mountFixed,
  };
};

const decodeFailure = (
  cause: Schema.SchemaError
): Result.Result<never, InvalidHostConfiguration> =>
  Result.fail(
    new InvalidHostConfiguration({
      cause,
      issuePaths: issuePaths(cause),
      issues: ["host-configuration-decode-failed"],
    })
  );

const missingExternalProviderCapability = () =>
  Result.fail(
    new InvalidHostConfiguration({
      cause: new Schema.SchemaError(new SchemaIssue.MissingKey(undefined)),
      issuePaths: ["externalProviders.provider"],
      issues: ["host-configuration-decode-failed"],
    })
  );

const missingBorrowProviderCapability = () =>
  Result.fail(
    new InvalidHostConfiguration({
      issuePaths: [semanticIssuePath["borrow-provider-capability-missing"]],
      issues: ["borrow-provider-capability-missing"],
    })
  );

const combineExternalProvider = (
  values: HostConfigurationValueData["externalProviders"],
  capability: ExternalProviderCapability
): Result.Result<
  ExternalProviderSnapshot | undefined,
  InvalidHostConfiguration
> => {
  if (!values) return Result.succeed(undefined);
  if (!capability.settings?.provider) {
    return missingExternalProviderCapability();
  }

  const common = {
    currentAddress: values.currentAddress,
    ...(values.currentChain === undefined
      ? {}
      : { currentChain: values.currentChain }),
    ...(values.initToken === undefined ? {} : { initToken: values.initToken }),
    ...(values.supportedChainIds
      ? { supportedChainIds: [...values.supportedChainIds] }
      : {}),
    type: values.type,
  };

  if (!capability.borrow) {
    return Result.succeed({
      ...common,
      borrow: false,
      provider: capability.settings.provider,
    });
  }

  // Bundle hosts are untyped: confirm the provider is an object carrying the
  // declared Borrow callbacks before Borrow can depend on them.
  const { provider } = capability.settings;
  return Predicate.hasProperty(provider, "sendBorrowTransaction") &&
    typeof provider.sendBorrowTransaction === "function" &&
    Predicate.hasProperty(provider, "signTypedData") &&
    typeof provider.signTypedData === "function"
    ? Result.succeed({
        ...common,
        borrow: true,
        provider,
      })
    : missingBorrowProviderCapability();
};

/** The Layout the host selects through the public `dashboardVariant` flag. */
export const hostLayout = (
  hostConfiguration: DecodedHostConfiguration
): WidgetLayout =>
  hostConfiguration.dashboardVariant ? "Dashboard" : "Compact";

type SemanticHostConfigurationIssue = Exclude<
  InvalidHostConfigurationIssue,
  "host-configuration-decode-failed"
>;

const semanticIssues = (
  hostConfiguration: DecodedHostConfiguration
): ReadonlyArray<SemanticHostConfigurationIssue> => {
  const issues: SemanticHostConfigurationIssue[] = [];

  if (
    hostConfiguration.borrowEnabled === true &&
    hostLayout(hostConfiguration) !== "Dashboard"
  ) {
    issues.push("borrow-requires-dashboard");
  }
  if (
    hostConfiguration.borrowEnabled === true &&
    hostConfiguration.yieldGrouping === "flat"
  ) {
    issues.push("borrow-requires-category-grouping");
  }
  if (hostConfiguration.variant === "zerion" && !hostConfiguration.chainModal) {
    issues.push("zerion-chain-modal-missing");
  }

  return issues;
};

const semanticIssuePath: Record<SemanticHostConfigurationIssue, string> = {
  "borrow-provider-capability-missing": "externalProviders.provider",
  "borrow-requires-category-grouping": "yieldGrouping",
  "borrow-requires-dashboard": "dashboardVariant",
  "zerion-chain-modal-missing": "chainModal",
};

export const decodeHostConfiguration = (
  hostConfiguration: SKHostConfiguration,
  mountFixed?: MountFixedHostSettings
): Result.Result<HostConfigurationDecodeSuccess, InvalidHostConfiguration> => {
  const decoded = Schema.decodeUnknownResult(HostConfigurationValues)(
    projectValues(hostConfiguration, mountFixed),
    { errors: "all" }
  );
  if (Result.isFailure(decoded)) return decodeFailure(decoded.failure);

  const capabilities = makeCapabilities(
    hostConfiguration,
    decoded.success.borrowEnabled
  );
  const externalProviders = combineExternalProvider(
    decoded.success.externalProviders,
    capabilities.externalProviders
  );
  if (Result.isFailure(externalProviders)) {
    return Result.fail(externalProviders.failure);
  }

  const theme =
    decoded.success.theme === undefined
      ? { theme: undefined, warnings: [] }
      : decodeTheme(decoded.success.theme);
  const chainIcons = keepNetworkEntries(
    "chainIconMapping",
    decoded.success.chainIconMapping,
    isNetwork,
    (value) => decodeIconUrl(value)
  );
  const preferredTokenYields = keepNetworkEntries(
    "preferredTokenYieldsPerNetwork",
    decoded.success.preferredTokenYieldsPerNetwork,
    isNetwork,
    decodePreferredYields
  );
  const providerOrder = keepProviderIds(decoded.success.yieldProviderOrder);
  const validators = keepNetworkEntries(
    "validatorsConfig",
    decoded.success.validatorsConfig,
    isNetworkOrAnyKey,
    (value) => decodeValidatorPolicy(value)
  );

  const configuration: DecodedHostConfiguration = {
    ...decoded.success,
    chainIconMapping: capabilities.chainIconMapper ?? chainIcons.entries,
    chainModal: capabilities.chainModal,
    externalProviders: externalProviders.success,
    mapWalletFn: capabilities.mapWalletFn,
    onMountAnimationComplete: capabilities.onMountAnimationComplete,
    portalContainer: capabilities.portalContainer,
    preferredTokenYieldsPerNetwork: preferredTokenYields.entries,
    theme: theme.theme,
    tokenIconMapping:
      capabilities.tokenIconMapper ?? decoded.success.tokenIconMapping,
    tracking: capabilities.tracking,
    validatorsConfig: validators.entries,
    yieldProviderOrder: providerOrder.order,
  };
  const issues = semanticIssues(configuration);
  if (issues.length > 0) {
    return Result.fail(
      new InvalidHostConfiguration({
        issuePaths: [
          ...new Set(issues.map((issue) => semanticIssuePath[issue])),
        ],
        issues,
      })
    );
  }

  return Result.succeed({
    configuration,
    warnings: [
      ...theme.warnings.map(
        (issue): HostConfigurationWarning => ({ _tag: "Theme", issue })
      ),
      ...chainIcons.warnings,
      ...preferredTokenYields.warnings,
      ...validators.warnings,
      ...providerOrder.warnings,
    ],
  });
};

/** How the widget looks while it shows that the Host Configuration was rejected. */
export type RejectedConfigurationPresentation = Readonly<{
  layout: WidgetLayout;
  theme: SKTheme | undefined;
  variant: HostVariant;
}>;

const isHostVariant = Schema.is(Schema.Literals(hostVariantValues));

/**
 * Decodes the presentation fields of a rejected Host Configuration one by
 * one, so the widget-unavailable notice can still match the host. Invalid
 * fields fall back to the defaults instead of failing again.
 */
export const decodeRejectedConfigurationPresentation = (
  hostConfiguration: Partial<SKHostConfiguration>
): RejectedConfigurationPresentation => ({
  layout: hostConfiguration.dashboardVariant === true ? "Dashboard" : "Compact",
  theme:
    hostConfiguration.theme === undefined
      ? undefined
      : decodeTheme(hostConfiguration.theme).theme,
  variant: isHostVariant(hostConfiguration.variant)
    ? hostConfiguration.variant
    : "default",
});
