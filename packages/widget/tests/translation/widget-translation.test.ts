import { Deferred, Effect, Layer, Ref, SubscriptionRef } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import type { SKAppProps } from "../../src/public-api/types";
import {
  type WidgetConfig,
  WidgetConfigService,
} from "../../src/services/config/widget-config";
import {
  composeWidgetTranslationResources,
  createWidgetI18nInstance,
  reconcileWidgetI18n,
  WidgetTranslation,
} from "../../src/services/translation/widget-translation";

const makeSettings = (overrides: Partial<WidgetConfig> = {}): WidgetConfig =>
  normalizeWidgetConfig({
    apiKey: "test-key",
    variant: "default",
    ...overrides,
  } as SKAppProps);

const makeTranslationLayer = (
  config: SubscriptionRef.SubscriptionRef<WidgetConfig>,
  initial: WidgetConfig,
  load: (language: string) => Effect.Effect<Readonly<Record<string, unknown>>>
) => {
  const configLayer = WidgetConfigService.layer({
    changes: SubscriptionRef.changes(config),
    current: SubscriptionRef.get(config),
    initial,
  });
  const httpClientLayer = Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request, url) => {
      const language = url.pathname.split("/").at(-2) ?? "";

      return load(language).pipe(
        Effect.map((body) =>
          HttpClientResponse.fromWeb(
            request,
            new Response(JSON.stringify(body), {
              headers: { "content-type": "application/json" },
              status: 200,
            })
          )
        )
      );
    })
  );

  return WidgetTranslation.layerNoDeps.pipe(
    Layer.provide(Layer.merge(configLayer, httpClientLayer))
  );
};

const expectEventually = <T>(read: () => T, expected: T) =>
  Effect.promise(() => expect.poll(read).toBe(expected));

describe("WidgetTranslation", () => {
  it("exposes initialized local resources while enrichment is pending", async () => {
    const initial = makeSettings({
      customTranslations: {
        en: {
          translation: {
            details: { rewards: { receive_output: "INITIALIZED" } },
          },
        },
      },
    });
    const config = await Effect.runPromise(SubscriptionRef.make(initial));
    const loadStarted = await Effect.runPromise(Deferred.make<void>());

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const translation = yield* WidgetTranslation;

          expect(translation.i18n.t("details.rewards.receive_output")).toBe(
            "INITIALIZED"
          );
          yield* Deferred.await(loadStarted);
        })
      ).pipe(
        Effect.provide(
          makeTranslationLayer(config, initial, () =>
            Deferred.succeed(loadStarted, undefined).pipe(
              Effect.andThen(Effect.never)
            )
          )
        )
      )
    );
  });

  it("owns exact live reconciliation and API/host precedence", async () => {
    const initial = makeSettings({
      customTranslations: {
        en: {
          translation: {
            details: { rewards: { receive_output: "CUSTOM" } },
            errors: { shared: "HOST" },
          },
        },
      },
      variant: "utila",
    });
    const config = await Effect.runPromise(SubscriptionRef.make(initial));
    const loaded = await Effect.runPromise(Deferred.make<void>());

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const translation = yield* WidgetTranslation;

          expect(translation.i18n.t("details.rewards.receive_output")).toBe(
            "CUSTOM"
          );
          expect(translation.i18n.t("details.earn")).toBe("Stake");

          yield* Deferred.await(loaded);
          yield* expectEventually(
            () => translation.i18n.t("errors.shared"),
            "HOST"
          );
          expect(translation.i18n.t("errors.stale")).toBe("API");

          yield* SubscriptionRef.set(config, makeSettings());
          yield* expectEventually(
            () => translation.i18n.t("details.rewards.receive_output"),
            "You'll receive"
          );
          expect(translation.i18n.t("details.earn")).toBe("Earn");
          expect(translation.i18n.t("errors.shared")).toBe("REMOTE");
          expect(translation.i18n.t("errors.stale")).toBe("API");
        })
      ).pipe(
        Effect.provide(
          makeTranslationLayer(config, initial, () =>
            Deferred.succeed(loaded, undefined).pipe(
              Effect.as({ shared: "REMOTE", stale: "API" })
            )
          )
        )
      )
    );
  });

  it("does not apply a stale language response after config changes", async () => {
    const initial = makeSettings({ language: "en" });
    const config = await Effect.runPromise(SubscriptionRef.make(initial));
    const englishStarted = await Effect.runPromise(Deferred.make<void>());
    const releaseEnglish = await Effect.runPromise(Deferred.make<void>());
    const frenchStarted = await Effect.runPromise(Deferred.make<void>());

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const translation = yield* WidgetTranslation;
          yield* Deferred.await(englishStarted);

          yield* SubscriptionRef.set(config, makeSettings({ language: "fr" }));
          yield* Deferred.await(frenchStarted);
          yield* expectEventually(
            () => translation.i18n.t("errors.shared"),
            "FR_CURRENT"
          );

          yield* Deferred.succeed(releaseEnglish, undefined);
          yield* Effect.yieldNow;
          expect(translation.i18n.language).toBe("fr");
          expect(translation.i18n.t("errors.shared")).toBe("FR_CURRENT");
        })
      ).pipe(
        Effect.provide(
          makeTranslationLayer(config, initial, (language) => {
            if (language === "fr") {
              return Deferred.succeed(frenchStarted, undefined).pipe(
                Effect.as({ shared: "FR_CURRENT" })
              );
            }

            return Deferred.succeed(englishStarted, undefined).pipe(
              Effect.andThen(Deferred.await(releaseEnglish)),
              Effect.as({ shared: "EN_STALE" })
            );
          })
        )
      )
    );
  });

  it("ignores unrelated config changes while enrichment is pending", async () => {
    const initial = makeSettings({ language: "en" });
    const config = await Effect.runPromise(SubscriptionRef.make(initial));
    const loadCount = await Effect.runPromise(Ref.make(0));
    const loadStarted = await Effect.runPromise(Deferred.make<void>());
    const releaseLoad = await Effect.runPromise(Deferred.make<void>());

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const translation = yield* WidgetTranslation;
          yield* Deferred.await(loadStarted);

          yield* SubscriptionRef.set(
            config,
            makeSettings({
              disableInjectedProviderDiscovery: true,
              language: "en",
            })
          );
          yield* Effect.sleep("20 millis");
          yield* Deferred.succeed(releaseLoad, undefined);
          yield* expectEventually(
            () => translation.i18n.t("errors.shared"),
            "REMOTE"
          );

          expect(yield* Ref.get(loadCount)).toBe(1);
        })
      ).pipe(
        Effect.provide(
          makeTranslationLayer(config, initial, () =>
            Ref.updateAndGet(loadCount, (count) => count + 1).pipe(
              Effect.tap(() => Deferred.succeed(loadStarted, undefined)),
              Effect.andThen(Deferred.await(releaseLoad)),
              Effect.as({ shared: "REMOTE" })
            )
          )
        )
      )
    );
  });

  it("does not cache an older same-language response that resolves last", async () => {
    const initial = makeSettings({ language: "en" });
    const config = await Effect.runPromise(SubscriptionRef.make(initial));
    const loadCount = await Effect.runPromise(Ref.make(0));
    const firstStarted = await Effect.runPromise(Deferred.make<void>());
    const releaseFirst = await Effect.runPromise(Deferred.make<void>());
    const secondStarted = await Effect.runPromise(Deferred.make<void>());

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const translation = yield* WidgetTranslation;
          yield* Deferred.await(firstStarted);

          yield* SubscriptionRef.set(
            config,
            makeSettings({
              customTranslations: {
                en: { translation: { details: { earn: "CUSTOM" } } },
              },
              language: "en",
            })
          );
          yield* Deferred.await(secondStarted);
          yield* expectEventually(
            () => translation.i18n.t("errors.shared"),
            "NEW"
          );

          yield* Deferred.succeed(releaseFirst, undefined);
          yield* Effect.yieldNow;
          yield* SubscriptionRef.set(
            config,
            makeSettings({ language: "en", variant: "utila" })
          );
          yield* expectEventually(
            () => translation.i18n.t("details.earn"),
            "Stake"
          );
          expect(translation.i18n.t("errors.shared")).toBe("NEW");
          expect(yield* Ref.get(loadCount)).toBe(2);
        })
      ).pipe(
        Effect.provide(
          makeTranslationLayer(config, initial, () =>
            Ref.updateAndGet(loadCount, (count) => count + 1).pipe(
              Effect.flatMap((call) => {
                if (call === 1) {
                  return Deferred.succeed(firstStarted, undefined).pipe(
                    Effect.andThen(Deferred.await(releaseFirst)),
                    Effect.as({ shared: "OLD" })
                  );
                }

                return Deferred.succeed(secondStarted, undefined).pipe(
                  Effect.as({ shared: "NEW" })
                );
              })
            )
          )
        )
      )
    );
  });

  it("creates a clean i18next instance for each scoped generation", async () => {
    const acquire = async (settings: WidgetConfig) => {
      const config = await Effect.runPromise(SubscriptionRef.make(settings));
      return Effect.runPromise(
        Effect.scoped(WidgetTranslation).pipe(
          Effect.provide(
            makeTranslationLayer(config, settings, () => Effect.succeed({}))
          )
        )
      );
    };
    const first = await acquire(
      makeSettings({
        customTranslations: {
          en: {
            translation: {
              details: { rewards: { receive_output: "FIRST" } },
            },
          },
        },
      })
    );
    const second = await acquire(makeSettings());

    expect(first.i18n).not.toBe(second.i18n);
    expect(first.i18n.t("details.rewards.receive_output")).toBe("FIRST");
    expect(second.i18n.t("details.rewards.receive_output")).toBe(
      "You'll receive"
    );
  });
});

describe("WidgetTranslation resource ownership", () => {
  it("rebuilds exact resources without mutating canonical translations", () => {
    const customized = composeWidgetTranslationResources({
      apiErrors: undefined,
      customTranslations: {
        en: {
          translation: {
            details: { rewards: { receive_output: "CUSTOM" } },
          },
        },
      },
      language: "en",
      variant: "default",
    });
    const canonical = composeWidgetTranslationResources({
      apiErrors: undefined,
      customTranslations: undefined,
      language: "en",
      variant: "default",
    });

    expect(customized.en.translation.details.rewards.receive_output).toBe(
      "CUSTOM"
    );
    expect(canonical.en.translation.details.rewards.receive_output).toBe(
      "You'll receive"
    );
  });

  it("applies canonical, variant, API error, then host precedence", () => {
    const resources = composeWidgetTranslationResources({
      apiErrors: { shared: "API" },
      customTranslations: {
        en: {
          translation: {
            errors: { shared: "HOST" },
          },
        },
      },
      language: "en",
      variant: "utila",
    });

    expect(resources.en.translation.details.earn).toBe("Stake");
    expect(resources.en.translation.errors).toMatchObject({ shared: "HOST" });
  });

  it("replaces omitted keys when reconciling a live generation", () => {
    const i18n = createWidgetI18nInstance();
    reconcileWidgetI18n({
      i18n,
      language: "en",
      resources: composeWidgetTranslationResources({
        apiErrors: { removed: "OLD" },
        customTranslations: undefined,
        language: "en",
        variant: "default",
      }),
    });
    expect(i18n.t("errors.removed")).toBe("OLD");

    reconcileWidgetI18n({
      i18n,
      language: "en",
      resources: composeWidgetTranslationResources({
        apiErrors: undefined,
        customTranslations: undefined,
        language: "en",
        variant: "default",
      }),
    });
    expect(i18n.exists("errors.removed")).toBe(false);
  });
});
