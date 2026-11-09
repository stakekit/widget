import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { PositionSourceDetails } from "../../../src/features/position-details/ui/components/position-source-details";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils.dom.tsx";

describe("Position source details", () => {
  it("does not offer disclosure when there are no detail rows", async () => {
    const app = await render(
      <I18nextProvider i18n={createWidgetI18nInstance()}>
        <PositionSourceDetails
          hasDetails={false}
          logo={undefined}
          name="Aave"
          stakeType="Deposited"
        />
      </I18nextProvider>
    );

    expect(app.container.textContent).toContain("Deposited via Aave");
    expect(
      app.container.querySelector(
        '[data-testid="position-source-details-trigger"]'
      )
    ).toBeNull();
  });
});
