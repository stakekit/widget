import type { SKExternalProviders } from "@sk-widget/domain/types/wallets";
import { SKApiClientProvider } from "@sk-widget/providers/api/api-client-provider";
import { ton } from "@sk-widget/providers/misc/chains";
import { solana } from "@sk-widget/providers/misc/chains";
import { SKQueryClientProvider } from "@sk-widget/providers/query-client";
import { SettingsContextProvider } from "@sk-widget/providers/settings";
import { SKWalletProvider, useSKWallet } from "@sk-widget/providers/sk-wallet";
import { TrackingContextProviderWithProps } from "@sk-widget/providers/tracking";
import { WagmiConfigProvider } from "@sk-widget/providers/wagmi/provider";
import { MiscNetworks } from "@stakekit/common";
import { http } from "msw";
import { HttpResponse, delay } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../mocks/server";
import { renderHook, waitFor } from "../utils/test-utils";

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

    server.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        await delay();
        return HttpResponse.json([MiscNetworks.Solana]);
      })
    );

    const solanaWallet = renderHookWithExternalProvider({
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
    await waitFor(() =>
      expect(solanaWallet.result.current.isConnected).toBe(true)
    );

    const solanaRes = await solanaWallet.result.current.signTransaction({
      network: "solana",
      tx: "12345",
      txMeta: {
        txId: "",
        actionId: "",
        actionType: "STAKE",
        txType: "APPROVAL",
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
      }
    );
  });

  it("should work with ton external provider", async () => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async (_: unknown) => "hash");

    server.use(
      http.get("*/v1/yields/enabled/networks", async () => {
        await delay();
        return HttpResponse.json([MiscNetworks.Ton]);
      })
    );

    const tonWallet = renderHookWithExternalProvider({
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
    await waitFor(() =>
      expect(tonWallet.result.current.isConnected).toBe(true)
    );

    const tonRes = await tonWallet.result.current.signTransaction({
      network: "ton",
      tx: JSON.stringify({ seqno: 0, message: "12345" }),
      txMeta: {
        txId: "",
        actionId: "",
        actionType: "STAKE",
        txType: "APPROVAL",
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
      }
    );
  });
});
