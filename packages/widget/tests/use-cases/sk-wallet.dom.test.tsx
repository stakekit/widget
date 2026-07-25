import { useAtomSet } from "@effect/atom-react";
import {
  Address,
  beginCell,
  type CommonMessageInfoRelaxedInternal,
  internal,
  storeMessageRelaxed,
} from "@ton/core";
import { Schema } from "effect";
import { HttpResponse, http } from "msw";
import { ThirdPartyQueryClientProvider } from "../../src/app/composition/providers/query-client";
import { normalizeWidgetConfig } from "../../src/app/config/settings";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { ActionId, TransactionId } from "../../src/domain/schema/identifiers";
import { solana, ton } from "../../src/domain/types/chains/misc";
import { MiscNetworks } from "../../src/domain/types/chains/networks";
import { useSKWallet } from "../../src/features/wallet/state";
import { WagmiConfigProvider } from "../../src/features/wallet/ui";
import type { SKExternalProviders, SKTxMeta } from "../../src/public-api/types";
import type { WalletSignTransactionInput } from "../../src/services/wallet/domain/transactions";
import { WalletService } from "../../src/services/wallet/wallet-service";
import { legacyApiRoute } from "../mocks/api-routes";
import { mockDelay } from "../mocks/delay";
import { TestAtomRuntimeProvider } from "../utils/atom-runtime-provider";
import { describe, expect, it, vi } from "../utils/test-extend.dom";
import { renderHook } from "../utils/test-utils.dom";

const signTransactionAtom = walletRuntime.fn(
  (input: WalletSignTransactionInput) =>
    WalletService.use((wallet) => wallet.signTransaction(input))
);

const useTestWallet = () => {
  const wallet = useSKWallet();
  const signTransaction = useAtomSet(signTransactionAtom, { mode: "promise" });

  return { ...wallet, signTransaction };
};

const renderHookWithExternalProvider = (
  externalProviders: SKExternalProviders,
  options: {
    variant?: "default" | "utila";
  } = {}
) =>
  renderHook(useTestWallet, {
    wrapper: ({ children }) => (
      <ThirdPartyQueryClientProvider>
        <TestAtomRuntimeProvider
          settings={normalizeWidgetConfig({
            apiKey: import.meta.env.VITE_API_KEY,
            externalProviders,
            variant: options.variant ?? "default",
          })}
        >
          <WagmiConfigProvider>{children}</WagmiConfigProvider>
        </TestAtomRuntimeProvider>
      </ThirdPartyQueryClientProvider>
    ),
  });

const waitForWalletConnection = (
  wallet: Awaited<ReturnType<typeof renderHookWithExternalProvider>>
) =>
  wallet.act(async () => {
    await expect
      .poll(
        () =>
          !wallet.result.current.isConnecting &&
          wallet.result.current.isConnected
      )
      .toBe(true);
  });

const createSolanaTxMeta = (): SKTxMeta => ({
  txId: Schema.decodeSync(TransactionId)("transaction-id"),
  actionId: Schema.decodeSync(ActionId)("action-id"),
  actionType: "STAKE",
  txType: "APPROVAL",
  amount: "100",
  inputToken: {
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
  txId: Schema.decodeSync(TransactionId)("transaction-id"),
  actionId: Schema.decodeSync(ActionId)("action-id"),
  actionType: "STAKE",
  txType: "APPROVAL",
  amount: "100",
  inputToken: {
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

    await waitForWalletConnection(solanaWallet);

    const solanaRes = await solanaWallet.result.current.signTransaction({
      network: "solana",
      tx: "AQIDBA==",
      txMeta: createSolanaTxMeta(),
      ledgerHwAppId: null,
    });

    expect(solanaRes).toEqual({
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

    await waitForWalletConnection(solanaWallet);

    const solanaRes = await solanaWallet.result.current.signTransaction({
      network: "solana",
      tx: "0xA1B2",
      txMeta: createSolanaTxMeta(),
      ledgerHwAppId: null,
    });

    expect(solanaRes).toEqual({
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

    await waitForWalletConnection(solanaWallet);

    const solanaRes = solanaWallet.result.current.signTransaction({
      network: "solana",
      tx: "12345",
      txMeta: {
        txId: Schema.decodeSync(TransactionId)("transaction-id"),
        actionId: Schema.decodeSync(ActionId)("action-id"),
        actionType: "STAKE",
        txType: "APPROVAL",
        amount: "100",
        inputToken: {
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

    await expect(solanaRes).rejects.toMatchObject({
      _tag: "WalletBroadcastError",
      customMessage,
    });
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
    await waitForWalletConnection(tonWallet);

    const tonFixture = createDefaultTonTransactionFixture();
    const tonRes = await tonWallet.result.current.signTransaction({
      network: "ton",
      tx: tonFixture.tx,
      txMeta: createTonTxMeta(),
      ledgerHwAppId: null,
    });

    expect(tonRes).toEqual({
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
    await waitForWalletConnection(tonWallet);

    const tonRes = await tonWallet.result.current.signTransaction({
      network: "ton",
      tx: JSON.stringify(rawTx),
      txMeta: createTonTxMeta(),
      ledgerHwAppId: null,
    });

    expect(tonRes).toEqual({
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
