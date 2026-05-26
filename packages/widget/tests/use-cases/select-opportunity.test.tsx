import { delay, HttpResponse, http } from "msw";
import { userEvent } from "vitest/browser";
import {
  legacyYieldFixture,
  yieldApiNetworkFixture,
  yieldApiYieldFixture,
  yieldRiskSummaryFixture,
} from "../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../mocks/api-routes";
import { describe, expect, it } from "../utils/test-extend";
import { renderApp } from "../utils/test-utils";

type LegacyTokenDto = ReturnType<typeof legacyYieldFixture>["token"];

describe("Select opportunity", () => {
  // This loads cosmos wagmi config, which takes some time, so we need to increase the timeout
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
          return { ...token, name: "Rocket Pool ETH", symbol: "rETH" };
        case "ethereum-eth-lido-staking":
          return { ...token, name: "Lido Staked ETH", symbol: "stETH" };
        default:
          return { ...token, name: "Banana ETH", symbol: "bananaETH" };
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
    const getYieldApiYield = (integrationId: (typeof yieldIds)[number]) =>
      yieldApiYieldFixture({
        id: integrationId,
        network: token.network,
        token,
        tokens: [token],
        inputTokens: [token],
        outputToken: getRewardToken(integrationId),
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

    worker.use(
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await delay();

        return HttpResponse.json(
          (
            [
              "ethereum",
              "ethereum-goerli",
              "avalanche-c",
              "celo",
              "akash",
              "cosmos",
              "kava",
              "osmosis",
              "juno",
              "stargaze",
              "persistence",
              "axelar",
              "onomy",
              "quicksilver",
              "agoric",
              "band-protocol",
              "bitsong",
              "chihuahua",
              "comdex",
              "crescent",
              "cronos",
              "cudos",
              "fetch-ai",
              "gravity-bridge",
              "injective",
              "irisnet",
              "ki-network",
              "mars-protocol",
              "regen",
              "secret",
              "sentinel",
              "sommelier",
              "teritori",
              "umee",
              "coreum",
              "desmos",
              "dydx",
              "optimism",
              "fantom",
              "arbitrum",
              "polygon",
              "binance",
              "near",
              "harmony",
              "solana",
              "tezos",
            ] as const
          ).map((id) => yieldApiNetworkFixture({ id }))
        );
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
        selectContainer
          .getByTestId(/^select-opportunity__item_ethereum-eth-lido-staking/)
          .getByText("A-")
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
          /^risk-rating__select-opportunity__item_ethereum-eth-reth-staking/
        )
      )
      .not.toBeInTheDocument();

    await expect
      .element(
        selectContainer.getByTestId(
          /^select-opportunity__item_ethereum-eth-stakewise-staking/
        )
      )
      .not.toBeInTheDocument();

    await selectContainer
      .getByTestId(/^select-opportunity__item_ethereum-eth-reth-staking/)
      .click();

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

    await app.getByText("EVM").click();

    await expect.element(app.getByText("Connect a Wallet")).toBeInTheDocument();

    await userEvent.keyboard("[Escape]");

    await app.getByTestId("select-opportunity").click();

    selectContainer = app.getByTestId("select-modal__container");

    await selectContainer
      .getByTestId(/^select-opportunity__item_ethereum-eth-lido-staking/)
      .click();

    await expect
      .element(app.getByText("You'll receive").first())
      .toBeInTheDocument();
    await expect.element(app.getByText("stETH").first()).toBeInTheDocument();
    await expect.element(app.getByText("Rated by Credora")).toBeInTheDocument();
    await expect
      .element(app.getByTestId("yield-risk-rating-summary").getByText("A-"))
      .toBeInTheDocument();

    app.unmount();
  });
});
