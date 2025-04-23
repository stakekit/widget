import { SKApp, type SKAppProps } from "@sk-widget/App";
import { solana, ton } from "@sk-widget/providers/misc/chains";
import { VirtualizerObserveElementRectProvider } from "@sk-widget/providers/virtual-scroll";
import { formatAddress } from "@sk-widget/utils";
import type { TokenDto, YieldDto } from "@stakekit/api-hooks";
import { getYieldV2ControllerGetYieldByIdResponseMock } from "@stakekit/api-hooks/msw";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse, delay } from "msw";
import { Just } from "purify-ts";
import { avalanche, mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../mocks/server";
import { renderApp, waitFor, within } from "../../utils/test-utils";

describe("External Provider", () => {
  it("Handles changing address and supported chains correctly", async () => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async () => "hash");

    const skProps = {
      apiKey: import.meta.env.VITE_API_KEY,
      externalProviders: {
        type: "generic",
        provider: {
          signMessage: async () => "hash",
          switchChain: switchChainSpy,
          sendTransaction: sendTransactionSpy,
        },
        currentAddress: "0xB6c5273e79E2aDD234EBC07d87F3824e0f94B2F7",
        supportedChainIds: [mainnet.id, avalanche.id, solana.id, ton.id],
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

    const solanaToken: TokenDto = {
      network: "solana",
      name: "Solana",
      symbol: "SOL",
      decimals: 9,
      coinGeckoId: "solana",
      logoURI: "https://assets.stakek.it/tokens/sol.svg",
    };

    const tonToken: TokenDto = {
      network: "ton",
      name: "Toncoin",
      symbol: "TON",
      decimals: 9,
      coinGeckoId: "the-open-network",
      logoURI: "https://assets.stakek.it/tokens/ton.svg",
    };

    const avalancheAvaxNativeStaking = Just(
      getYieldV2ControllerGetYieldByIdResponseMock()
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
      getYieldV2ControllerGetYieldByIdResponseMock()
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

    const solanaNativeStaking = Just(
      getYieldV2ControllerGetYieldByIdResponseMock()
    )
      .map(
        (val) =>
          ({
            ...val,
            id: "solana-sol-native-staking",
            token: solanaToken,
            tokens: [solanaToken],
            status: { enter: true, exit: true },
            args: { enter: { args: { nfts: undefined } } },
            metadata: {
              ...val.metadata,
              type: "staking",
              gasFeeToken: solanaToken,
            },
          }) satisfies YieldDto
      )
      .unsafeCoerce();

    const tonNativeStaking = Just(
      getYieldV2ControllerGetYieldByIdResponseMock()
    )
      .map(
        (val) =>
          ({
            ...val,
            id: "ton-native-staking",
            token: tonToken,
            tokens: [tonToken],
            status: { enter: true, exit: true },
            args: { enter: { args: { nfts: undefined } } },
            metadata: {
              ...val.metadata,
              type: "staking",
              gasFeeToken: tonToken,
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
          solanaNativeStaking.token.network,
          tonNativeStaking.token.network,
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
          { token: solanaToken, availableYields: [solanaNativeStaking.id] },
          { token: tonToken, availableYields: [tonNativeStaking.id] },
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
          {
            token: solanaToken,
            amount: "3",
            availableYields: [solanaNativeStaking.id],
          },
          {
            token: tonToken,
            amount: "3",
            availableYields: [tonNativeStaking.id],
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
      }),
      http.get(`*/v1/yields/${solanaNativeStaking.id}`, async () => {
        await delay();

        return HttpResponse.json(solanaNativeStaking);
      }),
      http.get(`*/v1/yields/${tonNativeStaking.id}`, async () => {
        await delay();

        return HttpResponse.json(tonNativeStaking);
      })
    );

    await waitFor(() =>
      expect(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      ).toBeInTheDocument()
    );

    const chainNames = {
      eth: "Ethereum",
      avalanche: "Avalanche",
      solana: "Solana",
      ton: "Ton",
    } as const;

    const element = await waitFor(() => {
      const el =
        app.queryByText(chainNames.eth) ||
        app.queryByText(chainNames.avalanche) ||
        app.queryByText(chainNames.solana) ||
        app.queryByText(chainNames.ton);

      if (!el) throw new Error("Element not found");

      expect(el).toBeInTheDocument();

      return el;
    });

    element.click();

    const getChainOptions = () =>
      app
        .getAllByTestId("rk-chain-option", { exact: false })
        .filter((el) => (el as HTMLButtonElement).type === "button");

    await waitFor(() => expect(getChainOptions().length).toBe(4));

    const user = userEvent.setup();

    const solanaOption = getChainOptions().find(
      (option) =>
        within(option as HTMLElement).queryByText(chainNames.solana) !== null
    );

    if (!solanaOption) throw new Error("Solana option not found");

    (solanaOption as HTMLElement).click();

    await waitFor(() => {
      expect(switchChainSpy).toHaveBeenCalledWith(501);
    });

    user.keyboard("[Escape]");

    app.rerender(
      <VirtualizerObserveElementRectProvider>
        <SKApp
          {...skProps}
          externalProviders={{
            ...skProps.externalProviders,
            supportedChainIds: [avalanche.id, ton.id],
          }}
        />
      </VirtualizerObserveElementRectProvider>
    );

    await waitFor(() => {
      expect(
        app.queryByText(chainNames.avalanche) || app.queryByText(chainNames.ton)
      ).toBeInTheDocument();
    });

    (
      app.queryByText(chainNames.avalanche) || app.queryByText(chainNames.ton)
    )?.click();

    await waitFor(() => expect(getChainOptions().length).toBe(2));

    const tonOption = getChainOptions().find(
      (option) =>
        within(option as HTMLElement).queryByText(chainNames.ton) !== null
    );

    if (!tonOption) throw new Error("TON option not found");

    (tonOption as HTMLElement).click();

    await waitFor(() => {
      expect(switchChainSpy).toHaveBeenCalledWith(ton.id);
    });

    user.keyboard("[Escape]");

    expect(sendTransactionSpy).not.toHaveBeenCalled();

    skProps.externalProviders.currentAddress =
      "0xB7c5273e79E2aDD234EBC07d87F3824e0f94B2f7";

    app.rerender(
      <VirtualizerObserveElementRectProvider>
        <SKApp
          {...skProps}
          externalProviders={{
            ...skProps.externalProviders,
            supportedChainIds: [avalanche.id, ton.id],
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
            supportedChainIds: [avalanche.id, ton.id],
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
            supportedChainIds: [avalanche.id, ton.id],
          }}
        />
      </VirtualizerObserveElementRectProvider>
    );

    await waitFor(() =>
      expect(
        app.getByText(formatAddress(skProps.externalProviders.currentAddress))
      ).toBeInTheDocument()
    );
    app.unmount();
  });
});
