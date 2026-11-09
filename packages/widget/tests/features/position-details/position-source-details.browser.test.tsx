import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { PositionSourceDetails } from "../../../src/features/position-details/ui/components/position-source-details";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils";

const i18nInstance = createWidgetI18nInstance();

describe("Position source details", () => {
  it("does not offer disclosure when there are no detail rows", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <PositionSourceDetails
          hasDetails={false}
          logo={undefined}
          name="Aave"
          stakeType="Deposited"
        />
      </I18nextProvider>
    );

    await expect
      .element(app.getByText("Deposited via Aave"))
      .toBeInTheDocument();
    await expect
      .element(app.getByTestId("position-source-details-trigger"))
      .not.toBeInTheDocument();
  });
});
