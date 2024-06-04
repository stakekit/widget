import { SKApp, type SKAppProps } from "@sk-widget/App";
import { VirtualizerObserveElementRectProvider } from "@sk-widget/providers/virtual-scroll";
import { formatAddress } from "@sk-widget/utils";
import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { getYieldControllerYieldOpportunityResponseMock } from "@stakekit/api-hooks/msw";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { Just } from "purify-ts";
import { describe, expect, it } from "vitest";
import { server } from "../../mocks/server";
import { renderApp, waitFor, within } from "../../utils/test-utils";

describe("External Provider", () => {
  it("Handles changing address and supported chains correctly", async () => {
    const skProps = {
      apiKey: import.meta.env.VITE_API_KEY,
      externalProviders: {
        type: "generic",
        provider: {
          signMessage: async () => "hash",
          switchChain: async () => {},
          sendTransaction: async () => "hash",
        },
        currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
        supportedChainIds: [1, 43114],
      },
    } satisfies SKAppProps;

    const app = renderApp({ skProps });

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

      http.post("*/v1/tokens/balances/scan", async () => {
        await delay();
        return HttpResponse.json([
          {
            token: ether,
            amount: "3",
            availableYields: [etherNativeStaking.id],
          },
          {
            token: avalancheCToken,
            amount: "3",
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

    await waitFor(() =>
      expect(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      ).toBeInTheDocument()
    );

    const chainNames = { eth: "Ethereum", avalanche: "Avalanche" } as const;

    const element = await waitFor(() => {
      const el =
        app.queryByText(chainNames.eth) ||
        app.queryByText(chainNames.avalanche);

      if (!el) throw new Error("Element not found");

      expect(el).toBeInTheDocument();

      return el;
    });

    element.click();

    await waitFor(() =>
      expect(
        app.container.querySelectorAll("button[data-testid^='rk-chain-option']")
          .length
      ).toBe(2)
    );

    const user = userEvent.setup();
    user.keyboard("[Escape]");

    app.rerender(
      <VirtualizerObserveElementRectProvider>
        <SKApp
          {...skProps}
          externalProviders={{
            ...skProps.externalProviders,
            supportedChainIds: [43114],
          }}
        />
      </VirtualizerObserveElementRectProvider>
    );

    await waitFor(() =>
      expect(app.getByText(chainNames.avalanche)).toBeInTheDocument()
    );

    app.getByText(chainNames.avalanche).click();

    await waitFor(() =>
      expect(
        app.container.querySelectorAll("button[data-testid^='rk-chain-option']")
          .length
      ).toBe(1)
    );

    const container = app.container.querySelectorAll(
      "button[data-testid^='rk-chain-option']"
    )[0];

    if (!container) throw new Error("Container not found");

    within(container as HTMLElement).getByText(chainNames.avalanche);

    user.keyboard("[Escape]");

    skProps.externalProviders.currentAddress =
      "0xB7c5273e79E2aDD234EBC07d87F3824e0f94B2f7";

    app.rerender(
      <VirtualizerObserveElementRectProvider>
        <SKApp
          {...skProps}
          externalProviders={{
            ...skProps.externalProviders,
            supportedChainIds: [43114],
          }}
        />
      </VirtualizerObserveElementRectProvider>
    );

    await waitFor(() =>
      expect(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      ).toBeInTheDocument()
    );

    const prevAddress = skProps.externalProviders.currentAddress;
    skProps.externalProviders.currentAddress = "";

    app.rerender(
      <VirtualizerObserveElementRectProvider>
        <SKApp
          {...skProps}
          externalProviders={{
            ...skProps.externalProviders,
            supportedChainIds: [43114],
          }}
        />
      </VirtualizerObserveElementRectProvider>
    );

    await waitFor(() =>
      expect(app.queryByText(formatAddress(prevAddress))).toBeNull()
    );

    skProps.externalProviders.currentAddress =
      "0xB7c5273e79E2aDD234EBC07d87F3824e0f94B2f7";

    app.rerender(
      <VirtualizerObserveElementRectProvider>
        <SKApp
          {...skProps}
          externalProviders={{
            ...skProps.externalProviders,
            supportedChainIds: [43114],
          }}
        />
      </VirtualizerObserveElementRectProvider>
    );

    await waitFor(() =>
      expect(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      ).toBeInTheDocument()
    );
  });
});
