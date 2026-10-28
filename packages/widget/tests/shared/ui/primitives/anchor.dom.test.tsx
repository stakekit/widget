import { Trans } from "react-i18next";
import { describe, expect, it } from "vitest";
import { createWidgetI18nInstance } from "../../../../src/services/translation/widget-translation";
import { SKAnchor } from "../../../../src/shared/ui/primitives/anchor";
import { render } from "../../../utils/test-utils.dom.tsx";

describe("SKAnchor", () => {
  it("links to the URL a translation places inside it", async () => {
    const app = await render(
      <Trans
        i18n={createWidgetI18nInstance()}
        defaults="Read <link0>https://example.com/terms</link0>."
        components={{ link0: <SKAnchor /> }}
      />
    );

    expect(app.container.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.com/terms"
    );

    app.unmount();
  });
});
