import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { ReviewOverview } from "../../../src/features/yield-transaction-flow/ui/review/pages/review-overview";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils";

const i18nInstance = createWidgetI18nInstance();

describe("Yield Exit Review Receive Token", () => {
  it("keeps the position amount and shows the selected receive token separately", async () => {
    const app = await render(
      <I18nextProvider i18n={i18nInstance}>
        <ReviewOverview
          facts={[{ label: "Receive token", value: "USDC" }]}
          amount="1 sUSDS"
          title="Withdraw"
          token={null}
        />
      </I18nextProvider>
    );

    await expect.element(app.getByText("1 sUSDS")).toBeInTheDocument();
    await expect.element(app.getByText("Receive token")).toBeInTheDocument();
    await expect.element(app.getByText("USDC")).toBeInTheDocument();
  });
});
