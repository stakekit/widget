import {
  Context,
  Deferred,
  Effect,
  Equal,
  FiberHandle,
  Layer,
  Predicate,
  Ref,
  Schema,
  type Scope,
  Stream,
  Struct,
} from "effect";
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http";
import { createInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import { mergeDeep } from "../../shared/effect/merge-deep";
import type { HostProfile } from "../config/host-profile";
import { WidgetConfigService } from "../config/widget-config";
import type { WidgetConfig } from "../config/widget-config-model";
import translationEN from "./English/translations.json";
import utilaTranslations from "./English/utila-variant.json";
import translationFR from "./French/translations.json";

const localResources = {
  en: { translation: translationEN },
  fr: { translation: translationFR },
} as const;

declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      [
        Key in keyof (typeof localResources)["en"]
      ]: (typeof localResources)["en"][Key] & {
        errors: Record<
          string,
          | string
          | {
              readonly title: string;
              readonly details: string;
              readonly solution: string;
            }
        >;
      };
    };
  }
}

const ApiErrorTranslations = Schema.Record(Schema.String, Schema.Unknown);
type ApiErrorTranslations = typeof ApiErrorTranslations.Type;
type SupportedLanguage = keyof typeof localResources;
type CustomTranslations = WidgetConfig["customTranslations"];
type WidgetTranslationSettings = Pick<
  WidgetConfig,
  "customTranslations" | "language"
> &
  Pick<HostProfile, "translationOverlay">;

const selectWidgetTranslationSettings = (
  settings: WidgetConfig
): WidgetTranslationSettings => ({
  ...Struct.pick(settings, ["customTranslations", "language"]),
  translationOverlay: settings.hostProfile.translationOverlay,
});

const equalWidgetTranslationSettings = (
  next: WidgetTranslationSettings,
  previous: WidgetTranslationSettings
) =>
  next.language === previous.language &&
  next.translationOverlay === previous.translationOverlay &&
  Equal.equals(next.customTranslations, previous.customTranslations);

export const composeWidgetTranslationResources = ({
  apiErrors,
  customTranslations,
  language,
  translationOverlay,
}: {
  readonly apiErrors: ApiErrorTranslations | undefined;
  readonly customTranslations: CustomTranslations;
  readonly language: SupportedLanguage;
  readonly translationOverlay: HostProfile["translationOverlay"];
}) =>
  mergeDeep(
    localResources,
    translationOverlay === "utila"
      ? { en: { translation: utilaTranslations } }
      : {},
    apiErrors ? { [language]: { translation: { errors: apiErrors } } } : {},
    customTranslations ?? {}
  );

export const createWidgetI18nInstance = () => {
  const instance = createInstance();

  void instance
    .use(initReactI18next)
    .use(LanguageDetector)
    .init({
      resources: structuredClone(localResources),
      supportedLngs: Object.keys(localResources),
      fallbackLng: "en",
      initAsync: false,
      interpolation: { escapeValue: false },
      detection: { order: ["navigator", "localStorage"] },
    });
  instance.services.formatter?.add("lowercase", (value) => value.toLowerCase());

  return instance;
};

type WidgetI18nInstance = ReturnType<typeof createWidgetI18nInstance>;

const detectWidgetLanguage = (i18n: WidgetI18nInstance) => {
  const detected = i18n.services.languageDetector?.detect();

  return Array.isArray(detected) ? detected[0] : detected;
};

export const reconcileWidgetI18n = ({
  i18n,
  language,
  resources,
}: {
  readonly i18n: WidgetI18nInstance;
  readonly language: SupportedLanguage;
  readonly resources: ReturnType<typeof composeWidgetTranslationResources>;
}) => {
  for (const [resourceLanguage, bundle] of Object.entries(resources)) {
    i18n.removeResourceBundle(resourceLanguage, "translation");
    i18n.addResourceBundle(
      resourceLanguage,
      "translation",
      Predicate.isObject(bundle) ? bundle.translation : undefined,
      true,
      true
    );
  }

  void i18n.changeLanguage(language);
};

const resolveSupportedLanguage = (
  configured: SupportedLanguage | undefined,
  detected: string | readonly string[] | undefined
): SupportedLanguage => {
  if (configured) return configured;

  const candidate = Array.isArray(detected) ? detected[0] : detected;
  return candidate?.split("-")[0] === "fr" ? "fr" : "en";
};

const makeWidgetTranslation = Effect.fn("makeWidgetTranslation")(
  function* (): Effect.fn.Return<
    WidgetTranslation["Service"],
    never,
    HttpClient.HttpClient | Scope.Scope | WidgetConfigService
  > {
    const config = yield* WidgetConfigService;
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk
    );
    const i18n = createWidgetI18nInstance();
    const detectedLanguage = detectWidgetLanguage(i18n);
    const apiErrorsByLanguage = yield* Ref.make(
      new Map<SupportedLanguage, ApiErrorTranslations>()
    );
    // Holds the enrichment for the latest configuration only. Each new
    // configuration interrupts the previous enrichment before reconciling, so a
    // superseded response can never be cached or applied.
    const enrichment = yield* FiberHandle.make<void>();

    const loadApiErrors = Effect.fn("WidgetTranslation.loadApiErrors")(
      function* (language: SupportedLanguage) {
        return yield* client
          .get(
            `https://i18n.stakek.it/locales/${encodeURIComponent(language)}/errors.json`
          )
          .pipe(
            Effect.flatMap(
              HttpClientResponse.schemaBodyJson(ApiErrorTranslations)
            )
          );
      }
    );

    const reconcile = Effect.fn("WidgetTranslation.reconcile")(function* (
      settings: WidgetTranslationSettings,
      apiErrors: ApiErrorTranslations | undefined
    ) {
      const language = resolveSupportedLanguage(
        settings.language,
        detectedLanguage
      );
      yield* Effect.sync(() =>
        reconcileWidgetI18n({
          i18n,
          language,
          resources: composeWidgetTranslationResources({
            apiErrors,
            customTranslations: settings.customTranslations,
            language,
            translationOverlay: settings.translationOverlay,
          }),
        })
      );
    });

    const enrich = Effect.fn("WidgetTranslation.enrich")(
      function* (
        settings: WidgetTranslationSettings,
        language: SupportedLanguage
      ) {
        const apiErrors = yield* loadApiErrors(language);
        yield* Ref.update(apiErrorsByLanguage, (current) =>
          new Map(current).set(language, apiErrors)
        );
        yield* reconcile(settings, apiErrors);
      },
      (effect) => Effect.ignore(effect)
    );

    const applyConfig = Effect.fn("WidgetTranslation.applyConfig")(function* (
      settings: WidgetTranslationSettings
    ) {
      yield* FiberHandle.clear(enrichment);
      const language = resolveSupportedLanguage(
        settings.language,
        detectedLanguage
      );
      const cachedErrors = (yield* Ref.get(apiErrorsByLanguage)).get(language);
      yield* reconcile(settings, cachedErrors);
      if (cachedErrors) return;

      yield* FiberHandle.run(enrichment, enrich(settings, language));
    });

    // Local resources are ready before the module is exposed. Remote error
    // enrichment and subsequent configuration reconciliation remain scoped,
    // non-blocking background work for this Application Runtime Generation.
    const ready = yield* Deferred.make<void>();
    yield* config.values.pipe(
      Stream.map(selectWidgetTranslationSettings),
      Stream.changesWith(equalWidgetTranslationSettings),
      Stream.runForEach((settings) =>
        applyConfig(settings).pipe(
          Effect.ensuring(Deferred.succeed(ready, undefined))
        )
      ),
      Effect.forkScoped({ startImmediately: true })
    );
    yield* Deferred.await(ready);

    return WidgetTranslation.of({ i18n });
  }
);

export class WidgetTranslation extends Context.Service<
  WidgetTranslation,
  {
    readonly i18n: WidgetI18nInstance;
  }
>()(
  "@stakekit/widget/services/translation/widget-translation/WidgetTranslation"
) {
  static readonly layerNoDeps = Layer.effect(
    WidgetTranslation,
    makeWidgetTranslation()
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FetchHttpClient.layer)
  );
}
