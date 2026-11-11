import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { YieldFactsSection } from "../../../src/features/yield-summary/ui/components/yield-facts";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { yieldApiYieldFixture } from "../../fixtures";
import { render } from "../../utils/test-utils.dom";

describe("Makina capacity in About", () => {
  it("renders the capacity amount and its availability caption", async () => {
    const yieldDto = yieldApiYieldFixture({
      providerId: "makina",
      state: { capacityState: { current: "1.5", max: "2", remaining: "0.5" } },
    });
    const { container } = await render(
      <I18nextProvider i18n={createWidgetI18nInstance()}>
        <YieldFactsSection yieldDto={yieldDto} />
      </I18nextProvider>
    );
    expect(container.textContent).toContain("Capacity");
    expect(container.textContent).toContain("1.5 ETH / 2 ETH");
    expect(container.textContent).toContain("0.5 ETH available");
  });
});
