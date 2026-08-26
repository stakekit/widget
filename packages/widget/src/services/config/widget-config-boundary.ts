import { Data, Result, Schema, SchemaIssue } from "effect";
import type { ExternalProviderSnapshot } from "../../public-api/external-provider-contract";
import {
  decodeTheme,
  type SKTheme,
  type ThemeDecodeWarning,
} from "../../public-api/theme";
import {
  DashboardYieldCategory,
  EvmChainIds,
  MiscChainIds,
  type SettingsProps,
  type SKHostConfiguration,
  SubstrateChainIds,
  type SupportedSKChainIds,
  type VariantProps,
} from "../../public-api/types";

const optional = <S extends Schema.Constraint>(schema: S) =>
  Schema.optionalKey(Schema.UndefinedOr(schema));

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

const dashboardYieldCategoryValues =
  exhaustiveLiterals<DashboardYieldCategory>()([
    DashboardYieldCategory.RWA,
    DashboardYieldCategory.DeFi,
    DashboardYieldCategory.Stake,
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
  SettingsProps["validatorsConfig"]
>[string];

const validatorPolicyFields = {
  allowed: optional(Schema.Array(Schema.String)),
  blocked: optional(Schema.Array(Schema.String)),
  mergePreferredWithDefault: optional(Schema.Boolean),
  preferred: optional(Schema.Array(Schema.String)),
  preferredOnly: optional(Schema.Boolean),
} satisfies Record<keyof ValidatorPolicySettings, Schema.Constraint>;

const ValidatorPolicy = Schema.Struct(validatorPolicyFields);

const IconMapping = Schema.Record(Schema.String, Schema.String);
const PreferredTokenYieldsPerNetwork = Schema.Record(
  Schema.String,
  Schema.Record(Schema.String, Schema.String)
);

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
  supportsBorrow: optional(Schema.Boolean),
  type: Schema.Literals(externalProviderTypeValues),
} satisfies Record<ExternalProviderValueKey, Schema.Constraint>;

const ExternalProviderValues = Schema.Struct(externalProviderValueFields);

type WagmiSettings = NonNullable<SettingsProps["wagmi"]>;
type WagmiValueKey = Exclude<keyof WagmiSettings, "__customConnectors__">;

const wagmiValueFields = {
  forceWalletConnectOnly: optional(Schema.Boolean),
} satisfies Record<WagmiValueKey, Schema.Constraint>;

const WagmiValues = Schema.Struct(wagmiValueFields);

type OpaqueHostConfigurationKey =
  | "mapWalletFn"
  | "mapWalletListFn"
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
  chainIconMapping: optional(IconMapping),
  customTranslations: optional(CustomTranslations),
  dashboardVariant: optional(Schema.Boolean),
  dashboardYieldCategoryOrder: optional(
    Schema.Array(Schema.Literals(dashboardYieldCategoryValues))
  ),
  disableAutoScrollToTop: optional(Schema.Boolean),
  disableInitLayoutAnimation: optional(Schema.Boolean),
  disableInjectedProviderDiscovery: optional(Schema.Boolean),
  disableResizingInputFontSize: optional(Schema.Boolean),
  externalProviders: optional(ExternalProviderValues),
  hideAccountAndChainSelector: optional(Schema.Boolean),
  hideChainSelector: optional(Schema.Boolean),
  hideNetworkLogo: optional(Schema.Boolean),
  initialChain: optional(SupportedChainId),
  institutionalWallets: optional(Schema.Boolean),
  isSafe: optional(Schema.Boolean),
  language: optional(Schema.Literals(hostLanguageValues)),
  preferredTokenYieldsPerNetwork: optional(PreferredTokenYieldsPerNetwork),
  theme: optional(Schema.Unknown),
  tokenIconMapping: optional(IconMapping),
  tokensForEnabledYieldsOnly: optional(Schema.Boolean),
  tonConnectManifestUrl: optional(Schema.String),
  validatorsConfig: optional(Schema.Record(Schema.String, ValidatorPolicy)),
  variant: optional(Schema.Literals(hostVariantValues)),
  wagmi: optional(WagmiValues),
  yieldGrouping: optional(Schema.Literals(hostYieldGroupingValues)),
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

type HostCapabilities = Readonly<{
  chainIconMapper: ChainIconMapper | undefined;
  chainModal: ChainModal | undefined;
  externalProviders: SKHostConfiguration["externalProviders"];
  mapWalletFn: SettingsProps["mapWalletFn"];
  mapWalletListFn: SettingsProps["mapWalletListFn"];
  onMountAnimationComplete: SettingsProps["onMountAnimationComplete"];
  portalContainer: SettingsProps["portalContainer"];
  tokenIconMapper: TokenIconMapper | undefined;
  tracking: SettingsProps["tracking"];
  wagmiCustomConnectors: NonNullable<
    SettingsProps["wagmi"]
  >["__customConnectors__"];
}>;

export type DecodedHostConfiguration = Omit<
  HostConfigurationValueData,
  | "chainModal"
  | "externalProviders"
  | "tokenIconMapping"
  | "chainIconMapping"
  | "theme"
  | "wagmi"
> &
  Readonly<{
    chainIconMapping: SettingsProps["chainIconMapping"];
    chainModal: ChainModal | undefined;
    externalProviders: ExternalProviderSnapshot | undefined;
    mapWalletFn: SettingsProps["mapWalletFn"];
    mapWalletListFn: SettingsProps["mapWalletListFn"];
    onMountAnimationComplete: SettingsProps["onMountAnimationComplete"];
    portalContainer: SettingsProps["portalContainer"];
    theme: SKTheme | undefined;
    tokenIconMapping: SettingsProps["tokenIconMapping"];
    tracking: SettingsProps["tracking"];
    wagmi:
      | Readonly<{
          __customConnectors__: NonNullable<
            SettingsProps["wagmi"]
          >["__customConnectors__"];
          forceWalletConnectOnly: boolean | undefined;
        }>
      | undefined;
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

export type HostConfigurationWarning = Readonly<{
  readonly _tag: "Theme";
  readonly issue: ThemeDecodeWarning;
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

const makeCapabilities = (
  hostConfiguration: SKHostConfiguration
): HostCapabilities => ({
  chainIconMapper:
    typeof hostConfiguration.chainIconMapping === "function"
      ? hostConfiguration.chainIconMapping
      : undefined,
  chainModal:
    hostConfiguration.variant === "zerion"
      ? hostConfiguration.chainModal
      : undefined,
  externalProviders: hostConfiguration.externalProviders,
  mapWalletFn: hostConfiguration.mapWalletFn,
  mapWalletListFn: hostConfiguration.mapWalletListFn,
  onMountAnimationComplete: hostConfiguration.onMountAnimationComplete,
  portalContainer: hostConfiguration.portalContainer,
  tokenIconMapper:
    typeof hostConfiguration.tokenIconMapping === "function"
      ? hostConfiguration.tokenIconMapping
      : undefined,
  tracking: hostConfiguration.tracking,
  wagmiCustomConnectors: hostConfiguration.wagmi?.__customConnectors__,
});

const projectValues = (hostConfiguration: SKHostConfiguration): unknown => {
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

const combineExternalProvider = (
  values: HostConfigurationValueData["externalProviders"],
  capability: HostCapabilities["externalProviders"]
): Result.Result<
  ExternalProviderSnapshot | undefined,
  InvalidHostConfiguration
> => {
  if (!values) return Result.succeed(undefined);
  if (!capability?.provider) return missingExternalProviderCapability();

  const common = {
    currentAddress: values.currentAddress,
    currentChain: values.currentChain,
    initToken: values.initToken,
    supportedChainIds: values.supportedChainIds
      ? [...values.supportedChainIds]
      : undefined,
    type: values.type,
  };

  if (values.supportsBorrow === true) {
    return capability.supportsBorrow === true
      ? Result.succeed({
          ...common,
          provider: capability.provider,
          supportsBorrow: true,
        })
      : missingExternalProviderCapability();
  }

  return capability.supportsBorrow !== true
    ? Result.succeed({
        ...common,
        provider: capability.provider,
        supportsBorrow: values.supportsBorrow,
      })
    : missingExternalProviderCapability();
};

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
    hostConfiguration.dashboardVariant !== true
  ) {
    issues.push("borrow-requires-dashboard");
  }
  if (
    hostConfiguration.borrowEnabled === true &&
    hostConfiguration.yieldGrouping === "flat"
  ) {
    issues.push("borrow-requires-category-grouping");
  }
  if (
    hostConfiguration.borrowEnabled === true &&
    hostConfiguration.externalProviders &&
    hostConfiguration.externalProviders.supportsBorrow !== true
  ) {
    issues.push("borrow-provider-capability-missing");
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
  hostConfiguration: SKHostConfiguration
): Result.Result<HostConfigurationDecodeSuccess, InvalidHostConfiguration> => {
  const decoded = Schema.decodeUnknownResult(HostConfigurationValues)(
    projectValues(hostConfiguration),
    { errors: "all" }
  );
  if (Result.isFailure(decoded)) return decodeFailure(decoded.failure);

  const capabilities = makeCapabilities(hostConfiguration);
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

  const configuration: DecodedHostConfiguration = {
    ...decoded.success,
    chainIconMapping:
      capabilities.chainIconMapper ?? decoded.success.chainIconMapping,
    chainModal: capabilities.chainModal,
    externalProviders: externalProviders.success,
    mapWalletFn: capabilities.mapWalletFn,
    mapWalletListFn: capabilities.mapWalletListFn,
    onMountAnimationComplete: capabilities.onMountAnimationComplete,
    portalContainer: capabilities.portalContainer,
    theme: theme.theme,
    tokenIconMapping:
      capabilities.tokenIconMapper ?? decoded.success.tokenIconMapping,
    tracking: capabilities.tracking,
    wagmi: decoded.success.wagmi
      ? {
          __customConnectors__: capabilities.wagmiCustomConnectors,
          forceWalletConnectOnly: decoded.success.wagmi.forceWalletConnectOnly,
        }
      : undefined,
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
    warnings: theme.warnings.map((issue) => ({ _tag: "Theme", issue })),
  });
};
