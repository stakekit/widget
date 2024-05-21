import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { getYieldControllerYieldOpportunityResponseMock } from "@stakekit/api-hooks/msw";
import { http, HttpResponse, delay } from "msw";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { renderApp, waitFor, within } from "../utils/test-utils";

describe("Select opportunity", () => {
  it("Works as expected", async () => {
    const token: TokenDto = {
      network: "ethereum",
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      coinGeckoId: "ethereum",
      logoURI: "https://assets.stakek.it/tokens/eth.svg",
    };

    server.use(
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

        return Just(getYieldControllerYieldOpportunityResponseMock())
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

    const { getByTestId, getByText } = renderApp();

    await waitFor(() => getByTestId("select-opportunity").click());

    let selectContainer = await waitFor(() =>
      getByTestId("select-modal__container")
    );

    await waitFor(() =>
      expect(
        within(selectContainer).getByTestId("select-modal__search-input")
      ).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(
        within(selectContainer).getByTestId("select-modal__title")
      ).toBeInTheDocument()
    );

    selectContainer = await waitFor(() =>
      getByTestId("select-modal__container")
    );

    await waitFor(() =>
      expect(
        within(selectContainer).getByText("Liquid stake")
      ).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(
        within(selectContainer).getByTestId(
          "select-opportunity__item_ethereum-eth-lido-staking",
          { exact: false }
        )
      ).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(
        within(selectContainer).getByTestId(
          "select-opportunity__item_ethereum-eth-reth-staking",
          { exact: false }
        )
      ).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(
        within(selectContainer).queryByTestId(
          "select-opportunity__item_ethereum-eth-stakewise-staking",
          { exact: false }
        )
      ).not.toBeInTheDocument()
    );

    within(selectContainer)
      .getByTestId("select-opportunity__item_ethereum-eth-reth-staking", {
        exact: false,
      })
      .click();

    await waitFor(() =>
      expect(getByText("You'll receive rETH")).toBeInTheDocument()
    );

    await waitFor(() =>
      expect(getByText("Connect Wallet")).toBeInTheDocument()
    );

    getByText("Connect Wallet").click();

    await waitFor(() =>
      expect(getByText("Connect a Wallet")).toBeInTheDocument()
    );

    await getByTestId("select-opportunity").click();

    selectContainer = await waitFor(() =>
      getByTestId("select-modal__container")
    );

    within(selectContainer)
      .getByTestId("select-opportunity__item_ethereum-eth-lido-staking", {
        exact: false,
      })
      .click();

    await waitFor(() =>
      expect(getByText("You'll receive stETH")).toBeInTheDocument()
    );
  });
});
