import { RegistryProvider } from "@effect/atom-react";
import { Layer } from "effect";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { HelpModal } from "../../src/features/preferences/views";
import {
  composeWidgetTranslationResources,
  createWidgetI18nInstance,
  reconcileWidgetI18n,
  WidgetTranslation,
} from "../../src/services/translation/widget-translation";
import { render } from "../utils/test-utils.dom.tsx";

const makeI18n = () => {
  const i18n = createWidgetI18nInstance();
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
  return i18n;
};

/**
 * Mirrors SKApp children: host chrome beside HelpModal under one registry,
 * without wrapping the footer in WidgetTranslationGate.
 */
describe("HelpModal as SKApp children", () => {
  it("translates the modal while sibling host chrome stays mounted", async () => {
    const i18n = makeI18n();
    const expectedTitle = i18n.t("help_modals.what_is_stakekit.title");
    const app = await render(
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
        <div data-testid="widget-frame">frame</div>
        <div data-testid="host-chrome">
          <span data-testid="footer-link">Terms & Conditions</span>
          <HelpModal modal={{ type: "whatIsStakeKit" }} />
        </div>
      </RegistryProvider>
    );

    expect(
      app.container.querySelector('[data-testid="footer-link"]')?.textContent
    ).toBe("Terms & Conditions");

    await expect
      .poll(() => app.container.querySelector("button"))
      .not.toBeNull();

    await act(async () => {
      app.container.querySelector<HTMLButtonElement>("button")?.click();
    });

    await expect
      .poll(
        () => document.body.querySelector("[data-select-modal] h4")?.textContent
      )
      .toBe(expectedTitle);

    expect(expectedTitle).not.toBe("help_modals.what_is_stakekit.title");
    expect(
      app.container.querySelector('[data-testid="footer-link"]')?.textContent
    ).toBe("Terms & Conditions");

    app.unmount();
  });
});
