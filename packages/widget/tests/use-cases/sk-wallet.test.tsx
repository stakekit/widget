import {
  Address,
  beginCell,
  type CommonMessageInfoRelaxedInternal,
  internal,
  storeMessageRelaxed,
} from "@ton/core";
import { HttpResponse, http } from "msw";
import { solana, ton } from "../../src/domain/types/chains/misc";
import { MiscNetworks } from "../../src/domain/types/chains/networks";
import type { SKExternalProviders } from "../../src/domain/types/wallets";
import type { SKTxMeta } from "../../src/domain/types/wallets/generic-wallet";
import { SKApiClientProvider } from "../../src/providers/api/api-client-provider";
import { SKQueryClientProvider } from "../../src/providers/query-client";
import { SettingsContextProvider } from "../../src/providers/settings";
import { SKWalletProvider, useSKWallet } from "../../src/providers/sk-wallet";
import { SendTransactionError } from "../../src/providers/sk-wallet/errors";
import { SolanaProvider } from "../../src/providers/solana";
import { TrackingContextProviderWithProps } from "../../src/providers/tracking";
import { WagmiConfigProvider } from "../../src/providers/wagmi/provider";
import { legacyApiRoute } from "../mocks/api-routes";
import { mockDelay } from "../mocks/delay";
import { describe, expect, it, vi } from "../utils/test-extend";
import { renderHook } from "../utils/test-utils";

const renderHookWithExternalProvider = (
  externalProviders: SKExternalProviders,
  options: {
    variant?: "default" | "utila";
  } = {}
) =>
  renderHook(useSKWallet, {
    wrapper: ({ children }) => (
      <SettingsContextProvider
        variant={options.variant ?? "default"}
        apiKey={import.meta.env.VITE_API_KEY}
        externalProviders={externalProviders}
      >
        <SKApiClientProvider>
          <SKQueryClientProvider>
            <SolanaProvider>
              <WagmiConfigProvider>
                <TrackingContextProviderWithProps>
                  <SKWalletProvider>{children}</SKWalletProvider>
                </TrackingContextProviderWithProps>
              </WagmiConfigProvider>
            </SolanaProvider>
          </SKQueryClientProvider>
        </SKApiClientProvider>
      </SettingsContextProvider>
    ),
  });

const createSolanaTxMeta = (): SKTxMeta => ({
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
});

const createTonTxMeta = (): SKTxMeta => ({
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
});

const createDefaultTonTransactionFixture = () => {
  const message = internal({
    to: Address.parseRaw(
      "0:0000000000000000000000000000000000000000000000000000000000000000"
    ),
    value: 123n,
    body: "Deposit",
  });
  const info = message.info as CommonMessageInfoRelaxedInternal;

  return {
    tx: JSON.stringify({
      seqno: 0,
      message: beginCell()
        .store(storeMessageRelaxed(message))
        .endCell()
        .toBoc()
        .toString("base64"),
    }),
    rawTx: [
      {
        address: info.dest.toString(),
        amount: info.value.coins.toString(),
        payload: message.body.toBoc().toString("base64"),
      },
    ],
  };
};

describe("SK Wallet", () => {
  it("should work with solana external provider", async ({ worker }) => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async () => "hash");

    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await mockDelay();
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
      tx: "AQIDBA==",
      txMeta: createSolanaTxMeta(),
      ledgerHwAppId: null,
    });

    expect(solanaRes.extract()).toEqual({
      signedTx: "hash",
      broadcasted: true,
    });
    expect(sendTransactionSpy).toHaveBeenCalledWith(
      {
        type: "solana",
        tx: "01020304",
      },
      createSolanaTxMeta()
    );
  });

  it("keeps hex solana external provider transactions in hex form", async ({
    worker,
  }) => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async () => "hash");

    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await mockDelay();
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
      tx: "0xA1B2",
      txMeta: createSolanaTxMeta(),
      ledgerHwAppId: null,
    });

    expect(solanaRes.extract()).toEqual({
      signedTx: "hash",
      broadcasted: true,
    });
    expect(sendTransactionSpy).toHaveBeenCalledWith(
      {
        type: "solana",
        tx: "a1b2",
      },
      createSolanaTxMeta()
    );
  });

  it("preserves custom external provider transaction errors", async ({
    worker,
  }) => {
    const customMessage = "Transaction blocked by policy";
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async () => ({
      type: "error" as const,
      error: customMessage,
    }));

    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await mockDelay();
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

    expect(solanaRes.isLeft()).toBe(true);

    const error = solanaRes.extract() as SendTransactionError;

    expect(error).toBeInstanceOf(SendTransactionError);
    expect(error.message).toBe("Send transaction failed");
    expect(error.customMessage).toBe(customMessage);
  });

  it("should work with ton external provider", async ({ worker }) => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async (_: unknown) => "hash");

    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await mockDelay();
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
    await expect
      .poll(
        () =>
          !tonWallet.result.current.isConnecting &&
          tonWallet.result.current.isConnected
      )
      .toBe(true);

    const tonFixture = createDefaultTonTransactionFixture();
    const tonRes = await tonWallet.result.current.signTransaction({
      network: "ton",
      tx: tonFixture.tx,
      txMeta: createTonTxMeta(),
      ledgerHwAppId: null,
    });

    expect(tonRes.extract()).toEqual({
      signedTx: "hash",
      broadcasted: true,
    });
    expect(sendTransactionSpy).toHaveBeenCalledWith(
      {
        type: "ton",
        tx: tonFixture.rawTx,
      },
      createTonTxMeta()
    );
  });

  it("keeps raw ton transactions unchanged for external provider", async ({
    worker,
  }) => {
    const switchChainSpy = vi.fn(async (_: number) => {});
    const sendTransactionSpy = vi.fn(async (_: unknown) => "hash");
    const rawTx = [
      {
        address: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c",
        amount: "123",
        payload: "te6cckEBAQEAAgAAAA==",
      },
    ];

    worker.use(
      http.get(legacyApiRoute("/v1/yields/enabled/networks"), async () => {
        await mockDelay();
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
      tx: JSON.stringify(rawTx),
      txMeta: createTonTxMeta(),
      ledgerHwAppId: null,
    });

    expect(tonRes.extract()).toEqual({
      signedTx: "hash",
      broadcasted: true,
    });
    expect(sendTransactionSpy).toHaveBeenCalledWith(
      {
        type: "ton",
        tx: rawTx,
      },
      createTonTxMeta()
    );
  });
});
