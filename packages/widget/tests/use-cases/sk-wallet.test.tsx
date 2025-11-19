import { MiscNetworks } from "@stakekit/common";
import { delay, HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { solana, ton } from "../../src/domain/types/chains/misc";
import type { SKExternalProviders } from "../../src/domain/types/wallets";
import { SKApiClientProvider } from "../../src/providers/api/api-client-provider";
import { SKQueryClientProvider } from "../../src/providers/query-client";
import { SettingsContextProvider } from "../../src/providers/settings";
import { SKWalletProvider, useSKWallet } from "../../src/providers/sk-wallet";
import { TrackingContextProviderWithProps } from "../../src/providers/tracking";
import { WagmiConfigProvider } from "../../src/providers/wagmi/provider";
import { worker } from "../mocks/worker";
import { renderHook } from "../utils/test-utils";

const renderHookWithExternalProvider = (
  externalProviders: SKExternalProviders
) =>
  renderHook(useSKWallet, {
    wrapper: ({ children }) => (
      <SettingsContextProvider
        variant="default"
        apiKey={import.meta.env.VITE_API_KEY}
        externalProviders={externalProviders}
      >
        <SKApiClientProvider>
          <SKQueryClientProvider>
            <WagmiConfigProvider>
              <TrackingContextProviderWithProps>
                <SKWalletProvider>{children}</SKWalletProvider>
              </TrackingContextProviderWithProps>
            </WagmiConfigProvider>
          </SKQueryClientProvider>
        </SKApiClientProvider>
      </SettingsContextProvider>
    ),
  });

describe("SK Wallet", () => {
  it("should work with solana external provider", async () => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async () => "hash");

    worker.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        await delay();
        return HttpResponse.json([MiscNetworks.Solana]);
      })
    );

    const solanaWallet = await renderHookWithExternalProvider({
      type: "generic",
      currentAddress: "9TCnDo7Txc5bC9SnE9iKsU5CyffLfeK4nrv1BFUmxkiJ",
      currentChain: solana.id,
      supportedChainIds: [solana.id],
      provider: {
        signMessage: async () => "hash",
        switchChain: switchChainSpy,
        sendTransaction: sendTransactionSpy,
      },
    });

    await expect.poll(() => solanaWallet.result.current.isConnected).toBe(true);

    const solanaRes = await solanaWallet.result.current.signTransaction({
      network: "solana",
      tx: "12345",
      txMeta: {
        txId: "",
        actionId: "",
        actionType: "STAKE",
        txType: "APPROVAL",
        amount: "100",
        inputToken: {
          address: "",
          decimals: 0,
          symbol: "",
          name: "",
          network: "solana",
        },
        structuredTransaction: null,
        annotatedTransaction: null,
        providersDetails: [],
      },
      ledgerHwAppId: null,
    });

    expect(solanaRes.extract()).toEqual({
      signedTx: "hash",
      broadcasted: true,
    });
    expect(sendTransactionSpy).toHaveBeenCalledWith(
      {
        type: "solana",
        tx: "12345",
      },
      {
        txId: "",
        actionId: "",
        actionType: "STAKE",
        txType: "APPROVAL",
        amount: "100",
        inputToken: {
          address: "",
          decimals: 0,
          symbol: "",
          name: "",
          network: "solana",
        },
        structuredTransaction: null,
        annotatedTransaction: null,
        providersDetails: [],
      }
    );
  });

  it("should work with ton external provider", async () => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async (_: unknown) => "hash");

    worker.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        await delay();
        return HttpResponse.json([MiscNetworks.Ton]);
      })
    );

    const tonWallet = await renderHookWithExternalProvider({
      type: "generic",
      currentAddress: "UQDyiNAyPy8QRQy45-SjxzrbKVOTOVyXaVGPZSLI9jxHF_Sy",
      currentChain: ton.id,
      supportedChainIds: [ton.id],
      provider: {
        signMessage: async () => "hash",
        switchChain: switchChainSpy,
        sendTransaction: sendTransactionSpy,
      },
    });
    await expect.poll(() => tonWallet.result.current.isConnected).toBe(true);

    const tonRes = await tonWallet.result.current.signTransaction({
      network: "ton",
      tx: JSON.stringify({ seqno: 0, message: "12345" }),
      txMeta: {
        txId: "",
        actionId: "",
        actionType: "STAKE",
        txType: "APPROVAL",
        amount: "100",
        inputToken: {
          address: "",
          decimals: 0,
          symbol: "",
          name: "",
          network: "ton",
        },
        structuredTransaction: null,
        annotatedTransaction: null,
        providersDetails: [],
      },
      ledgerHwAppId: null,
    });

    expect(tonRes.extract()).toEqual({
      signedTx: "hash",
      broadcasted: true,
    });
    expect(sendTransactionSpy).toHaveBeenCalledWith(
      {
        type: "ton",
        tx: { seqno: 0n, message: "12345" },
      },
      {
        txId: "",
        actionId: "",
        actionType: "STAKE",
        txType: "APPROVAL",
        amount: "100",
        inputToken: {
          address: "",
          decimals: 0,
          symbol: "",
          name: "",
          network: "ton",
        },
        structuredTransaction: null,
        annotatedTransaction: null,
        providersDetails: [],
      }
    );
  });
});
