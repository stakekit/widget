import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { getYieldControllerYieldOpportunityResponseMock } from "@stakekit/api-hooks/msw";
import { http, HttpResponse, delay } from "msw";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { server } from "../mocks/server";
import { renderApp, waitFor } from "../utils/test-utils";

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

    const avalancheAvaxNativeStaking = Just(
      getYieldControllerYieldOpportunityResponseMock()
    )
      .map(
        (val) =>
          ({
            ...val,
            id: "avalanche-avax-native-staking",
            token: avalancheCToken,
            tokens: [avalancheCToken],
            status: { enter: true, exit: true },
            args: { enter: { args: { nfts: undefined } } },
            metadata: {
              ...val.metadata,
              type: "staking",
              gasFeeToken: avalancheCToken,
            },
          }) satisfies YieldDto
      )
      .unsafeCoerce();

    const etherNativeStaking = Just(
      getYieldControllerYieldOpportunityResponseMock()
    )
      .map(
        (val) =>
          ({
            ...val,
            id: "ethereum-eth-etherfi-staking",
            token: ether,
            tokens: [ether],
            status: { enter: true, exit: true },
            args: { enter: { args: { nfts: undefined } } },
            metadata: {
              ...val.metadata,
              type: "staking",
              gasFeeToken: ether,
            },
          }) satisfies YieldDto
      )
      .unsafeCoerce();

    server.use(
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

    const { queryByText, queryByTestId, unmount } = renderApp();

    await waitFor(() =>
      expect(queryByTestId("number-input")).toBeInTheDocument()
    );
    expect(queryByText("Manage")).toBeInTheDocument();
    expect(queryByText("Connect Wallet")).toBeInTheDocument();
    unmount();
  });
});
