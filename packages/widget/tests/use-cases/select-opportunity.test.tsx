import { delay, HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";
import {
  legacyYieldFixture,
  yieldApiYieldFixture,
  yieldRiskSummaryFixture,
} from "../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../mocks/api-routes";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

type LegacyTokenDto = ReturnType<typeof legacyYieldFixture>["token"];

describe("Select opportunity", () => {
  it("Works as expected", async ({ worker }) => {
    window.history.pushState({}, "", "/");

    const token: LegacyTokenDto = {
      network: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coinGeckoId: "ethereum",
      logoURI: "https://assets.stakek.it/tokens/eth.svg",
    };
    const yieldIds = [
      "ethereum-eth-lido-staking",
      "ethereum-eth-stakewise-staking",
      "ethereum-eth-reth-staking",
    ] as const;

    const legacyYieldBase = legacyYieldFixture();
    const yieldApiYieldBase = yieldApiYieldFixture();
    const getRewardToken = (integrationId: (typeof yieldIds)[number]) => {
      switch (integrationId) {
        case "ethereum-eth-reth-staking":
          return {
            ...token,
            address: "0xae78736cd615f374d3085123a210448e74fc6393",
            name: "Rocket Pool ETH",
            symbol: "rETH",
          };
        case "ethereum-eth-lido-staking":
          return {
            ...token,
            address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
            name: "Lido Staked ETH",
            symbol: "stETH",
          };
        default:
          return {
            ...token,
            address: "0x0000000000000000000000000000000000000001",
            name: "Banana ETH",
            symbol: "bananaETH",
          };
      }
    };
    const getLegacyYield = (integrationId: (typeof yieldIds)[number]) => {
      const rewardToken = getRewardToken(integrationId);

      return legacyYieldFixture({
        id: integrationId,
        args: { enter: { args: { nfts: undefined } } },
        token,
        metadata: {
          ...legacyYieldBase.metadata,
          type: "liquid-staking",
          rewardTokens: [rewardToken],
          provider: {
            id: "stakewise",
            name: "Stakewise",
            description: "",
            externalLink: "https://stakewise.io",
            logoURI: "https://assets.stakek.it/providers/stakewise.svg",
          },
        },
        status: {
          ...legacyYieldBase.status,
          enter: integrationId !== "ethereum-eth-stakewise-staking",
        },
      });
    };
    const getYieldApiYield = (integrationId: (typeof yieldIds)[number]) => {
      const rewardToken = getRewardToken(integrationId);

      return yieldApiYieldFixture({
        id: integrationId,
        network: token.network,
        providerId: "stakewise",
        token,
        tokens: [token],
        inputTokens: [token],
        outputToken: rewardToken,
        rewardRate: {
          ...yieldApiYieldBase.rewardRate,
          components: [
            {
              rate: yieldApiYieldBase.rewardRate.total,
              rateType: yieldApiYieldBase.rewardRate.rateType,
              token: rewardToken,
              yieldSource: "staking",
            },
          ],
        },
        status: {
          ...yieldApiYieldBase.status,
          enter: integrationId !== "ethereum-eth-stakewise-staking",
        },
        metadata: {
          ...yieldApiYieldBase.metadata,
          name: legacyYieldBase.metadata.name,
        },
        mechanics: {
          ...yieldApiYieldBase.mechanics,
          type: "staking",
          gasFeeToken: token,
        },
        risk:
          integrationId === "ethereum-eth-reth-staking"
            ? yieldRiskSummaryFixture({ ratings: [] })
            : yieldRiskSummaryFixture({
                ratings: [
                  {
                    rating:
                      integrationId === "ethereum-eth-lido-staking"
                        ? "A-"
                        : "B-",
                    source:
                      integrationId === "ethereum-eth-lido-staking"
                        ? "credora"
                        : "stakingRewards",
                  },
                ],
              }),
      });
    };

    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await delay();

        return HttpResponse.json(["ethereum", "polkadot"]);
      }),
      http.get(legacyApiRoute("/v1/tokens"), async () => {
        await delay();
        return HttpResponse.json([
          {
            token,
            availableYields: [
              "ethereum-eth-lido-staking",
              "ethereum-eth-stakewise-staking",
              "ethereum-eth-reth-staking",
            ],
          },
        ]);
      }),
      http.get(yieldApiRoute("/v1/yields"), async () => {
        await delay();

        const items = yieldIds.map((integrationId) =>
          getYieldApiYield(integrationId)
        );

        return HttpResponse.json({
          items,
          total: items.length,
          offset: 0,
          limit: items.length,
        });
      }),

      ...yieldIds.flatMap((integrationId) => {
        const legacyYield = getLegacyYield(integrationId);

        return [
          http.get(legacyApiRoute(`/v1/yields/${integrationId}`), async () => {
            await delay();
            return HttpResponse.json(legacyYield);
          }),
          http.get(yieldApiRoute(`/v1/yields/${integrationId}`), async () => {
            await delay();
            return HttpResponse.json(getYieldApiYield(integrationId));
          }),
        ];
      })
    );

    const app = await renderApp();
    const clickOpportunity = async (id: (typeof yieldIds)[number]) => {
      const item = app
        .getByTestId("select-modal__container")
        .getByTestId(new RegExp(`^select-opportunity__item_${id}`));

      await expect.element(item).toBeInTheDocument();
      await expect.poll(() => item.elements()[0]).toBeTruthy();
      await userEvent.click(item.elements()[0]);
    };
    const clickText = async (text: string) => {
      const item = app.getByText(text).first();

      await expect.element(item).toBeInTheDocument();
      await expect.poll(() => item.elements()[0]).toBeTruthy();
      (item.elements()[0] as HTMLElement).click();
    };

    await app.getByTestId("select-opportunity").click();

    let selectContainer = app.getByTestId("select-modal__container");

    await expect
      .element(selectContainer.getByTestId("select-modal__search-input"))
      .toBeInTheDocument();
    await expect
      .element(selectContainer.getByTestId("select-modal__title"))
      .toBeInTheDocument();

    selectContainer = app.getByTestId("select-modal__container");

    await expect
      .element(
        selectContainer.getByTestId(
          /^select-opportunity__item_ethereum-eth-lido-staking/
        )
      )
      .toBeInTheDocument();

    await expect
      .element(
        selectContainer.getByTestId(
          /^select-opportunity__item_ethereum-eth-reth-staking/
        )
      )
      .toBeInTheDocument();

    await expect
      .element(
        selectContainer.getByTestId(
          /^select-opportunity__item_ethereum-eth-stakewise-staking/
        )
      )
      .not.toBeInTheDocument();

    await clickOpportunity("ethereum-eth-reth-staking");

    await expect
      .element(app.getByText("You'll receive").first())
      .toBeInTheDocument();
    await expect.element(app.getByText("rETH").first()).toBeInTheDocument();
    await expect
      .element(app.getByTestId("yield-risk-rating-summary"))
      .not.toBeInTheDocument();

    await expect.element(app.getByText("Connect Wallet")).toBeInTheDocument();

    await app.getByText("Connect Wallet").click();

    await expect.element(app.getByText("Select a Chain")).toBeInTheDocument();

    await clickText("EVM");

    await expect.element(app.getByText("Connect a Wallet")).toBeInTheDocument();

    await userEvent.keyboard("[Escape]");

    await app.getByTestId("select-opportunity").click();

    selectContainer = app.getByTestId("select-modal__container");

    await clickOpportunity("ethereum-eth-lido-staking");

    await expect
      .element(app.getByText("You'll receive").first())
      .toBeInTheDocument();
    await expect.element(app.getByText("stETH").first()).toBeInTheDocument();
    await expect.element(app.getByText("Rated by Credora")).toBeInTheDocument();
    await expect
      .element(
        app.getByTestId("yield-risk-rating-summary__badge").getByText("A-")
      )
      .toBeInTheDocument();

    app.unmount();
  });
});
