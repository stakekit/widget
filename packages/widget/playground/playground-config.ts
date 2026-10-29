/**
 * The playground config: the mount props and harness modes a playground page runs
 * with. It lives in the page link, so a link reproduces a setup. Only settings
 * that differ from the defaults are written.
 */
import { Option, Schema, Struct } from "effect";

/** Default scripted wallet account. */
const scriptedWalletAccount = "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7";

/** Widget wallet list, a scripted host wallet, or a host wallet wrapping the injected EVM wallet. */
export const walletModes = ["builtin", "scripted", "injected"] as const;
export const hostVariants = ["default", "utila", "finery", "porto"] as const;
export const themes = ["dark", "light"] as const;
export const languages = ["auto", "en", "fr"] as const;

const ProviderIds = Schema.Array(Schema.String);
const ExtraProps = Schema.Record(Schema.String, Schema.Unknown);

const PlaygroundConfigSchema = Schema.Struct({
  wallet: Schema.Literals(walletModes),
  scriptedAddress: Schema.String,
  trackingLog: Schema.Boolean,
  variant: Schema.Literals(hostVariants),
  theme: Schema.Literals(themes),
  language: Schema.Literals(languages),
  dashboardVariant: Schema.Boolean,
  borrowEnabled: Schema.Boolean,
  hideGasFee: Schema.Boolean,
  yieldProviderOrder: Schema.Struct({
    rwa: Schema.optionalKey(ProviderIds),
    defi: Schema.optionalKey(ProviderIds),
    stake: Schema.optionalKey(ProviderIds),
  }),
  /** Further serialisable widget props, merged over the ones above. */
  extraProps: ExtraProps,
});

/** Decodes the panel's extra props text: a JSON object. */
export const decodeExtraProps = Schema.decodeUnknownOption(
  Schema.fromJsonString(ExtraProps)
);
export type PlaygroundConfig = typeof PlaygroundConfigSchema.Type;

export const defaultPlaygroundConfig: PlaygroundConfig = {
  wallet: "builtin",
  scriptedAddress: scriptedWalletAccount,
  trackingLog: false,
  variant: "default",
  theme: "dark",
  language: "auto",
  dashboardVariant: true,
  borrowEnabled: true,
  hideGasFee: false,
  yieldProviderOrder: {},
  extraProps: {},
};

/**
 * Host variants whose palette is drawn for one theme only (Utila light, Porto
 * dark); the theme setting does not apply to them.
 */
const singleThemeVariants: Partial<
  Record<PlaygroundConfig["variant"], PlaygroundConfig["theme"]>
> = { porto: "dark", utila: "light" };

/** The theme the variant is fixed to, if any. */
export const fixedVariantTheme = (variant: PlaygroundConfig["variant"]) =>
  singleThemeVariants[variant];

/** The theme a config mounts the widget with. */
export const mountedTheme = (config: PlaygroundConfig) =>
  fixedVariantTheme(config.variant) ?? config.theme;

/** Borrow requires the dashboard variant; the widget rejects it otherwise. */
export const mountedBorrowEnabled = (config: PlaygroundConfig) =>
  config.borrowEnabled && config.dashboardVariant;

const searchParam = "playground";

const decodeConfigChanges = Schema.decodeUnknownOption(
  Schema.fromJsonString(
    PlaygroundConfigSchema.mapFields(Struct.map(Schema.optionalKey))
  )
);

/** Reads the playground config from a page query string; a malformed one yields the defaults. */
export const readPlaygroundConfig = (search: string): PlaygroundConfig => {
  const raw = new URLSearchParams(search).get(searchParam);

  if (raw === null) return defaultPlaygroundConfig;

  return decodeConfigChanges(raw).pipe(
    Option.map((changes) => ({ ...defaultPlaygroundConfig, ...changes })),
    Option.getOrElse(() => {
      console.warn(
        `[playground] Ignoring the malformed "${searchParam}" link parameter`
      );
      return defaultPlaygroundConfig;
    })
  );
};

/** Writes the playground config into a page query string, keeping its other parameters. */
export const writePlaygroundConfig = (
  search: string,
  config: PlaygroundConfig
): string => {
  const params = new URLSearchParams(search);
  const changes = Object.fromEntries(
    Object.entries(config).filter(
      ([key, value]) =>
        JSON.stringify(value) !==
        JSON.stringify(Reflect.get(defaultPlaygroundConfig, key))
    )
  );

  params.delete(searchParam);
  if (Object.keys(changes).length > 0) {
    params.set(searchParam, JSON.stringify(changes));
  }

  const query = params.toString();
  return query === "" ? "" : `?${query}`;
};
