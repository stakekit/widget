import { delay, HttpResponse, http } from "msw";
import {
  legacyYieldFixture,
  yieldApiNetworkFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../mocks/api-routes";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

type LegacyTokenDto = ReturnType<typeof legacyYieldFixture>["token"];

describe("Renders initial page", () => {
  it("Works as expected", async ({ worker }) => {
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

    const legacyYieldBase = legacyYieldFixture();
    const yieldApiYieldBase = yieldApiYieldFixture();
    const avalancheAvaxNativeStaking = legacyYieldFixture({
      id: "avalanche-avax-native-staking",
      token: avalancheCToken,
      tokens: [avalancheCToken],
      metadata: {
        ...legacyYieldBase.metadata,
        type: "staking",
        gasFeeToken: avalancheCToken,
      },
    });
    const etherNativeStaking = legacyYieldFixture({
      id: "ethereum-eth-etherfi-staking",
      token: ether,
      tokens: [ether],
      metadata: {
        ...legacyYieldBase.metadata,
        type: "staking",
        gasFeeToken: ether,
      },
    });

    const avalancheAvaxNativeStakingYieldApi = yieldApiYieldFixture({
      id: avalancheAvaxNativeStaking.id,
      network: avalancheCToken.network,
      token: avalancheCToken,
      tokens: [avalancheCToken],
      inputTokens: [avalancheCToken],
      outputToken: avalancheCToken,
      mechanics: {
        ...yieldApiYieldBase.mechanics,
        type: "staking",
        gasFeeToken: avalancheCToken,
      },
    });
    const etherNativeStakingYieldApi = yieldApiYieldFixture({
      id: etherNativeStaking.id,
      network: ether.network,
      token: ether,
      tokens: [ether],
      inputTokens: [ether],
      outputToken: ether,
      mechanics: {
        ...yieldApiYieldBase.mechanics,
        type: "staking",
        gasFeeToken: ether,
      },
    });

    worker.use(
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await delay();
        return HttpResponse.json([
          yieldApiNetworkFixture({ id: etherNativeStaking.token.network }),
          yieldApiNetworkFixture({
            id: avalancheAvaxNativeStaking.token.network,
          }),
        ]);
      }),

      http.get(legacyApiRoute("/v1/tokens"), async () => {
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
