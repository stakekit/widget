import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";

import { setup } from "../../app/journeys/trust-incentive-apy/setup";
import { legacyApiRoute } from "../../mocks/api-routes";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

describe("Position details while prices are pending", () => {
  it("opens a Manage position without waiting for prices", async ({
    worker,
  }) => {
    const { account, customConnectors, setUrl } = await setup(worker, {
      editableAmounts: true,
    });
    const prices = Promise.withResolvers<void>();
    worker.use(
      http.post(legacyApiRoute("/v1/tokens/prices"), async () => {
        await prices.promise;
        return HttpResponse.json({
          "avalanche-c-undefined": { price: 1, price_24_h: 0 },
        });
      })
    );
    setUrl({ accountId: account });

    const app = await renderApp({
      walletListFactory: customConnectors,
      skProps: {
        apiKey: import.meta.env.VITE_API_KEY,
        dashboardVariant: true,
      },
    });

    await userEvent.click(
      app.getByRole("tab", { name: "Manage", exact: true })
    );
    await userEvent.click(app.getByText("Trust USDA Earn").first());

    await expect
      .element(app.getByRole("textbox", { name: "Amount" }))
      .toBeInTheDocument();
    expect(
      app.container.querySelector('[data-testid="position-details-skeleton"]')
    ).toBeNull();
    // The balance is valued by the API's amountUsd, not by prices.
    await expect
      .element(
        app.getByTestId("position-summary").getByText("$1M", { exact: true })
      )
      .toBeInTheDocument();

    await userEvent.click(
      app.getByRole("tab", { name: "Deposit", exact: true })
    );
    await userEvent.click(app.getByRole("textbox", { name: "Amount" }));
    await userEvent.keyboard("10");

    // The typed amount's fiat needs prices: a placeholder holds its place.
    const fiatPlaceholder =
      '[data-testid="position-details-enter-amount"] [aria-busy="true"]';
    await expect
      .poll(() => app.container.querySelector(fiatPlaceholder))
      .not.toBeNull();
    expect(app.getByText("$10.00").query()).toBeNull();

    prices.resolve();

    await expect.element(app.getByText("$10.00").first()).toBeInTheDocument();
    expect(app.container.querySelector(fiatPlaceholder)).toBeNull();

    await app.unmount();
  });
});
