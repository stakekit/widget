import { RegistryProvider } from "@effect/atom-react";
import { Layer } from "effect";
import { useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";
import { WidgetTranslationProvider } from "../../src/app/composition/providers/widget-translation";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import {
  composeWidgetTranslationResources,
  createWidgetI18nInstance,
  reconcileWidgetI18n,
  WidgetTranslation,
} from "../../src/services/translation/widget-translation";
import { render } from "../utils/test-utils.dom.tsx";

const TranslationProbe = () => {
  const { t } = useTranslation();
  return (
    <output data-testid="translation-copy">
      {t("details.rewards.receive_output")}
    </output>
  );
};

const makeI18n = (copy?: string) => {
  const i18n = createWidgetI18nInstance();
  reconcileWidgetI18n({
    i18n,
    language: "en",
    resources: composeWidgetTranslationResources({
      apiErrors: undefined,
      customTranslations: copy
        ? {
            en: {
              translation: {
                details: { rewards: { receive_output: copy } },
              },
            },
          }
        : undefined,
      language: "en",
      variant: "default",
    }),
  });
  return i18n;
};

const renderTranslationGeneration = (i18n: ReturnType<typeof makeI18n>) =>
  render(
    <RegistryProvider
      initialValues={[
        [
          appRuntime.layer,
          Layer.succeed(
            WidgetTranslation,
            WidgetTranslation.of({ i18n })
          ) as never,
        ],
      ]}
    >
      <WidgetTranslationProvider>
        <TranslationProbe />
      </WidgetTranslationProvider>
    </RegistryProvider>
  );

describe("WidgetTranslationProvider", () => {
  it("forwards the WidgetTranslation instance to the React tree", async () => {
    const i18n = makeI18n("SERVICE");
    const app = await renderTranslationGeneration(i18n);

    await expect
      .poll(
        () =>
          app.container.querySelector('[data-testid="translation-copy"]')
            ?.textContent
      )
      .toBe("SERVICE");

    app.unmount();
  });

  it("uses the clean service instance from a remounted runtime generation", async () => {
    const firstI18n = makeI18n("FIRST");
    const first = await renderTranslationGeneration(firstI18n);
    await expect
      .poll(
        () =>
          first.container.querySelector('[data-testid="translation-copy"]')
            ?.textContent
      )
      .toBe("FIRST");
    first.unmount();

    const secondI18n = makeI18n();
    const second = await renderTranslationGeneration(secondI18n);
    await expect
      .poll(
        () =>
          second.container.querySelector('[data-testid="translation-copy"]')
            ?.textContent
      )
      .toBe("You'll receive");

    second.unmount();
  });
});
