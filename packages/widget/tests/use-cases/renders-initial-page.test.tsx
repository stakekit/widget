import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { yieldFixture } from "../fixtures";
import { worker } from "../mocks/worker";
import { renderApp } from "../utils/test-utils";

describe("Renders initial page", () => {
  it("Works as expected", async () => {
    const avalancheCToken: TokenDto = {
      name: "Avalanche C Chain",
      symbol: "AVAX",
      decimals: 18,
      network: "avalanche-c",
      coinGeckoId: "avalanche-2",
      logoURI: "https://assets.stakek.it/tokens/avax.svg",
    };

    const ether: TokenDto = {
      network: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coinGeckoId: "ethereum",
      logoURI: "https://assets.stakek.it/tokens/eth.svg",
    };

    const avalancheAvaxNativeStaking = Just(yieldFixture())
      .map(
        (val) =>
          ({
            ...val,
            id: "avalanche-avax-native-staking",
            token: avalancheCToken,
            tokens: [avalancheCToken],
            metadata: {
              ...val.metadata,
              type: "staking",
              gasFeeToken: avalancheCToken,
            },
          }) satisfies YieldDto
      )
      .unsafeCoerce();

    const etherNativeStaking = Just(yieldFixture())
      .map(
        (val) =>
          ({
            ...val,
            id: "ethereum-eth-etherfi-staking",
            token: ether,
            tokens: [ether],
            metadata: {
              ...val.metadata,
              type: "staking",
              gasFeeToken: ether,
            },
          }) satisfies YieldDto
      )
      .unsafeCoerce();

    worker.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        await delay();
        return HttpResponse.json([
          etherNativeStaking.token.network,
          avalancheAvaxNativeStaking.token.network,
        ]);
      }),

      http.get("*/v1/tokens", async () => {
        await delay();

        return HttpResponse.json([
          { token: ether, availableYields: [etherNativeStaking.id] },
          {
            token: avalancheCToken,
            availableYields: [avalancheAvaxNativeStaking.id],
          },
        ]);
      }),

      http.get(`*/v1/yields/${etherNativeStaking.id}`, async () => {
        await delay();

        return HttpResponse.json(etherNativeStaking);
      }),
      http.get(`*/v1/yields/${avalancheAvaxNativeStaking.id}`, async () => {
        await delay();

        return HttpResponse.json(avalancheAvaxNativeStaking);
      })
    );

    const app = await renderApp();

    await expect.element(app.getByTestId("number-input")).toBeInTheDocument();
    await expect.element(app.getByText("Manage")).toBeInTheDocument();
    await expect.element(app.getByText("Connect Wallet")).toBeInTheDocument();

    app.unmount();
  });
});
