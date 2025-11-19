import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { delay, HttpResponse, http } from "msw";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { yieldFixture } from "../fixtures";
import { worker } from "../mocks/worker";
import { renderApp } from "../utils/test-utils";

describe("Select opportunity", () => {
  // This loads cosmos wagmi config, which takes some time, so we need to increase the timeout
  it("Works as expected", { timeout: 20000 }, async () => {
    const token: TokenDto = {
      network: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coinGeckoId: "ethereum",
      logoURI: "https://assets.stakek.it/tokens/eth.svg",
    };

    worker.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        await delay();

        return HttpResponse.json([
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

      http.get("*/v1/yields/:integrationId", async (info) => {
        const integrationId = info.params.integrationId as string;
        await delay();

        return Just(yieldFixture())
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
            } as YieldDto;
          })
          .map((val) => HttpResponse.json(val))
          .unsafeCoerce();
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
      .element(selectContainer.getByText("Liquid Staking"))
      .toBeInTheDocument();

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
