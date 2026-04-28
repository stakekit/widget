import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { yieldApiYieldFixtureFromLegacy, yieldFixture } from "../fixtures";
import { legacyApiRoute, yieldApiRoute } from "../mocks/api-routes";
import { worker } from "../mocks/worker";
import { renderApp } from "../utils/test-utils";

type LegacyTokenDto = ReturnType<typeof yieldFixture>["token"];

describe("Select opportunity", () => {
  // This loads cosmos wagmi config, which takes some time, so we need to increase the timeout
  it("Works as expected", { timeout: 20000 }, async () => {
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

    const getLegacyYield = (integrationId: (typeof yieldIds)[number]) =>
      Just(yieldFixture())
        .map((mock) => {
          const rewardToken = (() => {
            switch (integrationId) {
              case "ethereum-eth-reth-staking":
                return { ...token, name: "Rocket Pool ETH", symbol: "rETH" };
              case "ethereum-eth-lido-staking":
                return { ...token, name: "Lido Staked ETH", symbol: "stETH" };
              default:
                return { ...token, name: "Banana ETH", symbol: "bananaETH" };
            }
          })();

          return {
            ...mock,
            id: integrationId,
            args: { enter: { args: { nfts: undefined } } },
            token,
            metadata: {
              ...mock.metadata,
              type: "liquid-staking",
              rewardTokens: [rewardToken],
              provider: { name: "Stakewise" },
            },
            status: {
              ...mock.status,
              enter: integrationId !== "ethereum-eth-stakewise-staking",
            },
          } as ReturnType<typeof yieldFixture>;
        })
        .unsafeCoerce();

    worker.use(
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await delay();

        return HttpResponse.json([
          { id: "ethereum" },
          { id: "ethereum-goerli" },
          { id: "avalanche-c" },
          { id: "celo" },
          { id: "akash" },
          { id: "cosmos" },
          { id: "kava" },
          { id: "osmosis" },
          { id: "juno" },
          { id: "stargaze" },
          { id: "persistence" },
          { id: "axelar" },
          { id: "onomy" },
          { id: "quicksilver" },
          { id: "agoric" },
          { id: "band-protocol" },
          { id: "bitsong" },
          { id: "chihuahua" },
          { id: "comdex" },
          { id: "crescent" },
          { id: "cronos" },
          { id: "cudos" },
          { id: "fetch-ai" },
          { id: "gravity-bridge" },
          { id: "injective" },
          { id: "irisnet" },
          { id: "ki-network" },
          { id: "mars-protocol" },
          { id: "regen" },
          { id: "secret" },
          { id: "sentinel" },
          { id: "sommelier" },
          { id: "teritori" },
          { id: "umee" },
          { id: "coreum" },
          { id: "desmos" },
          { id: "dydx" },
          { id: "optimism" },
          { id: "fantom" },
          { id: "arbitrum" },
          { id: "polygon" },
          { id: "binance" },
          { id: "near" },
          { id: "harmony" },
          { id: "solana" },
          { id: "tezos" },
        ]);
      }),
      http.get("*/v1/tokens", async () => {
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
            return HttpResponse.json(
              yieldApiYieldFixtureFromLegacy({
                legacyYield,
              })
            );
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

    await selectContainer
      .getByTestId(/^select-opportunity__item_ethereum-eth-reth-staking/)
      .click();

    await expect
      .element(app.getByText("You'll receive").first())
      .toBeInTheDocument();
    await expect.element(app.getByText("rETH").first()).toBeInTheDocument();

    await expect.element(app.getByText("Connect Wallet")).toBeInTheDocument();

    await app.getByText("Connect Wallet").click();

    await expect.element(app.getByText("Select a Chain")).toBeInTheDocument();

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

    app.unmount();
  });
});
