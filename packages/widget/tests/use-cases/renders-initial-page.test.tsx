import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { yieldApiYieldFixtureFromLegacy, yieldFixture } from "../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../mocks/api-routes";
import { worker } from "../mocks/worker";
import { renderApp } from "../utils/test-utils";

type LegacyTokenDto = ReturnType<typeof yieldFixture>["token"];

describe("Renders initial page", () => {
  it("Works as expected", async () => {
    const avalancheCToken: LegacyTokenDto = {
      name: "Avalanche C Chain",
      symbol: "AVAX",
      decimals: 18,
      network: "avalanche-c",
      coinGeckoId: "avalanche-2",
      logoURI: "https://assets.stakek.it/tokens/avax.svg",
    };

    const ether: LegacyTokenDto = {
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
          }) satisfies ReturnType<typeof yieldFixture>
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
          }) satisfies ReturnType<typeof yieldFixture>
      )
      .unsafeCoerce();

    const avalancheAvaxNativeStakingYieldApi = yieldApiYieldFixtureFromLegacy({
      legacyYield: avalancheAvaxNativeStaking,
    });
    const etherNativeStakingYieldApi = yieldApiYieldFixtureFromLegacy({
      legacyYield: etherNativeStaking,
    });

    worker.use(
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await delay();
        return HttpResponse.json([
          { id: etherNativeStaking.token.network },
          { id: avalancheAvaxNativeStaking.token.network },
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

      http.get(
        legacyApiRoute(`/v1/yields/${etherNativeStaking.id}`),
        async () => {
          await delay();

          return HttpResponse.json(etherNativeStaking);
        }
      ),
      http.get(
        yieldApiRoute(`/v1/yields/${etherNativeStaking.id}`),
        async () => {
          await delay();

          return HttpResponse.json(etherNativeStakingYieldApi);
        }
      ),
      http.get(
        legacyApiRoute(`/v1/yields/${avalancheAvaxNativeStaking.id}`),
        async () => {
          await delay();

          return HttpResponse.json(avalancheAvaxNativeStaking);
        }
      ),
      http.get(
        yieldApiRoute(`/v1/yields/${avalancheAvaxNativeStaking.id}`),
        async () => {
          await delay();

          return HttpResponse.json(avalancheAvaxNativeStakingYieldApi);
        }
      )
    );

    const app = await renderApp();

    await expect.element(app.getByTestId("number-input")).toBeInTheDocument();
    await expect.element(app.getByText("Manage")).toBeInTheDocument();
    await expect.element(app.getByText("Connect Wallet")).toBeInTheDocument();

    app.unmount();
  });
});
