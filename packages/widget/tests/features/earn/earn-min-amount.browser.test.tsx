import { HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";

import { yieldApiYieldDtoFixture } from "../../fixtures";
import { yieldApiRoute } from "../../mocks/api-routes";
import { describe, expect, it } from "../../utils/test-extend";
import { renderApp } from "../../utils/test-utils";

const token = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  network: "ethereum",
  coinGeckoId: "ethereum",
  logoURI: "https://assets.stakek.it/tokens/eth.svg",
} as const;

/** The default mocked yield, taking at least 0.123456 ETH. */
const minimumYield = yieldApiYieldDtoFixture({
  id: "ethereum-eth-native-staking",
  token,
  tokens: [token],
  inputTokens: [token],
  outputToken: token,
  mechanics: {
    ...yieldApiYieldDtoFixture().mechanics,
    entryLimits: {
      minimum: "0.123456",
      maximum: null,
      subsequentMinimum: null,
    },
  },
});

describe("Earn Min", () => {
  it("fills the yield's minimum from a tap on its limit", async ({
    worker,
  }) => {
    worker.use(
      http.get(yieldApiRoute("/v1/yields"), () =>
        HttpResponse.json({
          items: [minimumYield],
          total: 1,
          limit: 20,
          offset: 0,
        })
      ),
      http.get(yieldApiRoute("/v1/yields/:yieldId"), () =>
        HttpResponse.json(minimumYield)
      )
    );

    const app = await renderApp();
    const amount = app.getByTestId("number-input");

    await userEvent.click(amount);
    await userEvent.keyboard("0.1");
    await expect.element(amount).toHaveValue("0.1");

    // The limit under the amount fills it in; no chip crowds the balance.
    const minimum = app.getByRole("button", { name: "Min 0.123456 ETH" });
    await expect
      .element(minimum)
      .toHaveAccessibleDescription("Fill in the minimum");
    await expect
      .element(app.getByRole("button", { name: "Min", exact: true }))
      .not.toBeInTheDocument();
    await userEvent.click(minimum);
    await expect.element(amount).toHaveValue("0.123456");

    await app.unmount();
  });
});
