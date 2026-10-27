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
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import {
  ActionId,
  TransactionId,
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WagmiConfigProvider } from "../../../src/features/wallet/composition";
import { useSKWallet } from "../../../src/features/wallet/index";
import type { SKExternalProviders } from "../../../src/public-api/types";
import {
  solana,
  ton,
} from "../../../src/services/wallet/internal/adapters/configured-chains";
import type { WalletOwnerCheckedInput } from "../../../src/services/wallet/wallet-commands";
import { WalletService } from "../../../src/services/wallet/wallet-service";
import type {
  WalletSignTransactionInput,
  YieldTransactionMeta,
} from "../../../src/services/wallet/wallet-transactions";
import { yieldApiRoute } from "../../mocks/api-routes";
import { mockDelay } from "../../mocks/delay";
import { TestAtomRuntimeProvider } from "../../utils/atom-runtime-provider";
import { describe, expect, it, vi } from "../../utils/test-extend.dom.ts";
import { renderHook } from "../../utils/test-utils.dom.tsx";
import { getTestWidgetConfig } from "../../utils/widget-config";

const signTransactionAtom = walletRuntime.fn(
  (input: WalletOwnerCheckedInput<WalletSignTransactionInput>) =>
    WalletService.use((wallet) => wallet.signTransaction(input))
);

const useTestWallet = () => {
  const wallet = useSKWallet();
  const signTransaction = useAtomSet(signTransactionAtom, { mode: "promise" });

  return { signTransaction, wallet };
};

const renderHookWithExternalProvider = (
  externalProviders: SKExternalProviders,
  options: {
    variant?: "default" | "utila";
  } = {}
) => {
  const variantProps =
    options.variant === "utila"
      ? ({ variant: "utila" } as const)
      : ({ variant: "default" } as const);

  return renderHook(useTestWallet, {
    wrapper: ({ children }) => (
      <TestAtomRuntimeProvider
        settings={getTestWidgetConfig({
          apiKey: import.meta.env.VITE_API_KEY,
          borrowEnabled: false,
          externalProviders,
          ...variantProps,
        })}
      >
        <WagmiConfigProvider>{children}</WagmiConfigProvider>
      </TestAtomRuntimeProvider>
    ),
  });
};

const waitForWalletConnection = (
  wallet: Awaited<ReturnType<typeof renderHookWithExternalProvider>>
) =>
  wallet.act(async () => {
    await expect
      .poll(() => wallet.result.current.wallet?.status === "connected")
      .toBe(true);
  });

const solanaAddress = "9TCnDo7Txc5bC9SnE9iKsU5CyffLfeK4nrv1BFUmxkiJ";
const tonAddress = "UQDyiNAyPy8QRQy45-SjxzrbKVOTOVyXaVGPZSLI9jxHF_Sy";

const createYieldTxMeta = ({
  address,
  network,
  yieldId,
}: {
  readonly address: string;
  readonly network: "solana" | "ton";
  readonly yieldId: string;
}): YieldTransactionMeta => ({
  txId: Schema.decodeSync(TransactionId)("transaction-id"),
  actionId: Schema.decodeSync(ActionId)("action-id"),
  actionType: "STAKE",
  txType: "APPROVAL",
  address: Schema.decodeSync(WalletAddress)(address),
  amount: "100",
  amountRaw: "100",
  inputToken: {
    decimals: 0,
    symbol: "",
    name: "",
    network,
  },
  rawArguments: null,
  structuredTransaction: null,
  annotatedTransaction: null,
  gasEstimate: undefined,
  providersDetails: [],
  yieldId: Schema.decodeSync(YieldId)(yieldId),
});

const createSolanaTxMeta = () =>
  createYieldTxMeta({
    address: solanaAddress,
    network: "solana",
    yieldId: "solana-sol-native-multivalidator-staking",
  });

const createTonTxMeta = () =>
  createYieldTxMeta({
    address: tonAddress,
    network: "ton",
    yieldId: "ton-ton-chorus-one-pools-staking",
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
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([{ id: "solana" }]);
      })
    );

    const solanaWallet = await renderHookWithExternalProvider({
      type: "generic",
      currentAddress: solanaAddress,
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
      expectedOwner: { address: solanaAddress, network: "solana" },
      family: "yield",
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
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([{ id: "solana" }]);
      })
    );

    const solanaWallet = await renderHookWithExternalProvider({
      type: "generic",
      currentAddress: solanaAddress,
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
      expectedOwner: { address: solanaAddress, network: "solana" },
      family: "yield",
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
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([{ id: "solana" }]);
      })
    );

    const solanaWallet = await renderHookWithExternalProvider({
      type: "generic",
      currentAddress: solanaAddress,
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
      expectedOwner: { address: solanaAddress, network: "solana" },
      family: "yield",
      network: "solana",
      tx: "12345",
      txMeta: createSolanaTxMeta(),
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
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([{ id: "ton" }]);
      })
    );

    const tonWallet = await renderHookWithExternalProvider({
      type: "generic",
      currentAddress: tonAddress,
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
      expectedOwner: { address: tonAddress, network: "ton" },
      family: "yield",
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
      http.get(yieldApiRoute("/v1/networks"), async () => {
        await mockDelay();
        return HttpResponse.json([{ id: "ton" }]);
      })
    );

    const tonWallet = await renderHookWithExternalProvider({
      type: "generic",
      currentAddress: tonAddress,
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
      expectedOwner: { address: tonAddress, network: "ton" },
      family: "yield",
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
