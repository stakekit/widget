import { Effect, Schema } from "effect";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { ActionId, TransactionId } from "../../src/domain/schema/identifiers";
import {
  ExternalProvider,
  ExternalProviderError,
} from "../../src/domain/types/external-providers";
import type { SKExternalProviders } from "../../src/domain/types/wallets";
import type {
  SKTx,
  SKTxMeta,
} from "../../src/domain/types/wallets/generic-wallet";

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

const makeProviderRef = (
  provider: SKExternalProviders["provider"]
): RefObject<SKExternalProviders> => ({
  current: {
    type: "generic",
    currentAddress: "solana-address",
    currentChain: 501,
    supportedChainIds: [501],
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
});
