import { Effect, Schema } from "effect";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActionId, TransactionId } from "../../src/domain/schema/identifiers";
import {
  ExternalProvider,
  ExternalProviderError,
  type ExternalProviderSnapshot,
} from "../../src/domain/types/external-providers";
import type {
  SKBorrowTxMeta,
  SKBorrowWallet,
  SKExternalProviders,
  SKTx,
  SKTxMeta,
} from "../../src/public-api/types";

const transaction = {
  type: "solana",
  tx: "01020304",
} satisfies SKTx;

const transactionMeta = {
  actionId: Schema.decodeSync(ActionId)("action-id"),
  actionType: "STAKE",
  amount: "1",
  annotatedTransaction: null,
  inputToken: undefined,
  providersDetails: [],
  structuredTransaction: null,
  txId: Schema.decodeSync(TransactionId)("transaction-id"),
  txType: "STAKE",
} satisfies SKTxMeta;

const borrowTransactionMeta = {
  actionId: "borrow-action-id",
  actionType: "borrow",
  address: "0x0000000000000000000000000000000000000001",
  integrationId: "aave-v3",
  rawArguments: {
    amount: "1",
    marketId: "aave-v3-ethereum-usdc",
  },
  txId: "borrow-transaction-id",
  txType: "BORROW",
} satisfies SKBorrowTxMeta;

const makeProviderRef = (
  provider: SKExternalProviders["provider"]
): RefObject<ExternalProviderSnapshot> => ({
  current: {
    type: "generic",
    currentAddress: "solana-address",
    currentChain: 501,
    supportedChainIds: [501],
    provider,
  },
});

const makeBorrowProviderRef = (
  provider: SKBorrowWallet
): RefObject<ExternalProviderSnapshot> => ({
  current: {
    type: "generic",
    currentAddress: "solana-address",
    currentChain: 501,
    supportedChainIds: [501],
    supportsBorrow: true,
    provider,
  },
});

describe("generic external provider callback contract", () => {
  it("passes message, chain, transaction, and metadata through Promise callbacks", async () => {
    const signMessage = vi.fn(async () => "signed-message");
    const switchChain = vi.fn(async () => undefined);
    const sendTransaction = vi.fn(async () => ({
      type: "success" as const,
      txHash: "broadcast-hash",
    }));
    const provider = new ExternalProvider(
      makeProviderRef({ signMessage, switchChain, sendTransaction })
    );

    await expect(
      Effect.runPromise(provider.signMessage("message-hash"))
    ).resolves.toBe("signed-message");
    await expect(
      Effect.runPromise(provider.switchChain({ chainId: 501 }))
    ).resolves.toBeUndefined();
    await expect(
      Effect.runPromise(provider.sendTransaction(transaction, transactionMeta))
    ).resolves.toBe("broadcast-hash");

    expect(signMessage).toHaveBeenCalledWith("message-hash");
    expect(switchChain).toHaveBeenCalledWith(501);
    expect(sendTransaction).toHaveBeenCalledWith(transaction, transactionMeta);
  });

  it("accepts legacy string hashes and preserves host error messages", async () => {
    const stringProvider = new ExternalProvider(
      makeProviderRef({
        signMessage: async () => "signed-message",
        switchChain: async () => undefined,
        sendTransaction: async () => "legacy-broadcast-hash",
      })
    );
    const errorProvider = new ExternalProvider(
      makeProviderRef({
        signMessage: async () => "signed-message",
        switchChain: async () => undefined,
        sendTransaction: async () => ({
          type: "error",
          error: "Transaction blocked by host policy",
        }),
      })
    );

    await expect(
      Effect.runPromise(
        stringProvider.sendTransaction(transaction, transactionMeta)
      )
    ).resolves.toBe("legacy-broadcast-hash");

    const error = await Effect.runPromise(
      Effect.flip(errorProvider.sendTransaction(transaction, transactionMeta))
    );
    expect(error).toBeInstanceOf(ExternalProviderError);
    expect((error as ExternalProviderError).customMessage).toBe(
      "Transaction blocked by host policy"
    );
  });

  it("sends Borrow transactions through the Borrow host capability", async () => {
    const sendTransaction = vi.fn(async () => "classic-hash");
    const sendBorrowTransaction = vi.fn(async () => "borrow-hash");
    const wallet = {
      signMessage: async () => "signed-message",
      switchChain: async () => undefined,
      sendBorrowTransaction,
      sendTransaction,
    } satisfies SKBorrowWallet;
    const provider = new ExternalProvider(makeBorrowProviderRef(wallet));

    await expect(
      Effect.runPromise(
        provider.sendBorrowTransaction(transaction, borrowTransactionMeta)
      )
    ).resolves.toBe("borrow-hash");

    expect(sendBorrowTransaction).toHaveBeenCalledWith(
      transaction,
      borrowTransactionMeta
    );
    expect(sendTransaction).not.toHaveBeenCalled();
  });

  it("rejects Borrow invocation when the live provider loses its Borrow capability", async () => {
    const provider = new ExternalProvider(
      makeProviderRef({
        signMessage: async () => "signed-message",
        switchChain: async () => undefined,
        sendTransaction: async () => "classic-hash",
      })
    );

    const error = await Effect.runPromise(
      Effect.flip(
        provider.sendBorrowTransaction(transaction, borrowTransactionMeta)
      )
    );

    expect(error).toBeInstanceOf(ExternalProviderError);
    expect((error as ExternalProviderError).message).toBe(
      "Borrow transaction capability is unavailable"
    );
  });
});
