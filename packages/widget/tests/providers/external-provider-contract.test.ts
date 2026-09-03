import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Schema } from "effect";
import type { RefObject } from "react";
import { ActionId, TransactionId } from "../../src/domain/identity/identifiers";
import type { ExternalProviderSnapshot } from "../../src/public-api/external-provider-contract";
import type {
  SKBorrowTx,
  SKBorrowTxMeta,
  SKBorrowWallet,
  SKExternalProviders,
  SKTx,
  SKTxMeta,
} from "../../src/public-api/types";
import {
  ExternalProvider,
  ExternalProviderError,
} from "../../src/services/wallet/external-provider";

const transaction = {
  type: "solana",
  tx: "01020304",
} satisfies SKTx;

const borrowTransaction = {
  type: "evm",
  tx: {
    chainId: "0x1",
    data: "0x1234",
    from: "0x0000000000000000000000000000000000000001",
    gas: "0x5208",
    gasPrice: "0x1",
    to: "0x0000000000000000000000000000000000000002",
    type: "0x1",
    value: undefined,
  },
} satisfies SKBorrowTx;

const typedData = {
  domain: { chainId: 1, name: "Borrow Authorization" },
  message: { owner: "0x0000000000000000000000000000000000000001" },
  primaryType: "Authorization",
  types: {
    Authorization: [{ name: "owner", type: "address" }],
  },
} as const;

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
  it.effect(
    "passes message, chain, transaction, and metadata through Promise callbacks",
    () =>
      Effect.gen(function* () {
        const signMessage = vi.fn(async () => "signed-message");
        const signTypedData = vi.fn(async () => "typed-signature");
        const switchChain = vi.fn(async () => undefined);
        const sendTransaction = vi.fn(async () => ({
          type: "success" as const,
          txHash: "broadcast-hash",
        }));
        const provider = new ExternalProvider(
          makeProviderRef({
            signMessage,
            signTypedData,
            switchChain,
            sendTransaction,
          })
        );

        expect(yield* provider.signMessage("message-hash")).toBe(
          "signed-message"
        );
        expect(yield* provider.signTypedData(typedData)).toBe(
          "typed-signature"
        );
        expect(yield* provider.switchChain({ chainId: 501 })).toBeUndefined();
        expect(
          yield* provider.sendTransaction(transaction, transactionMeta)
        ).toBe("broadcast-hash");

        expect(signMessage).toHaveBeenCalledWith("message-hash");
        expect(signTypedData).toHaveBeenCalledWith(typedData);
        expect(switchChain).toHaveBeenCalledWith(501);
        expect(sendTransaction).toHaveBeenCalledWith(
          transaction,
          transactionMeta
        );
      })
  );

  it.effect(
    "accepts legacy string hashes and preserves host error messages",
    () =>
      Effect.gen(function* () {
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

        expect(
          yield* stringProvider.sendTransaction(transaction, transactionMeta)
        ).toBe("legacy-broadcast-hash");

        const error = yield* Effect.flip(
          errorProvider.sendTransaction(transaction, transactionMeta)
        );
        expect(error).toBeInstanceOf(ExternalProviderError);
        expect((error as ExternalProviderError).customMessage).toBe(
          "Transaction blocked by host policy"
        );
      })
  );

  it.effect(
    "sends Borrow transactions through the Borrow host capability",
    () =>
      Effect.gen(function* () {
        const sendTransaction = vi.fn(async () => "classic-hash");
        const sendBorrowTransaction = vi.fn(async () => "borrow-hash");
        const wallet = {
          signMessage: async () => "signed-message",
          switchChain: async () => undefined,
          sendBorrowTransaction,
          sendTransaction,
        } satisfies SKBorrowWallet;
        const provider = new ExternalProvider(makeBorrowProviderRef(wallet));

        expect(
          yield* provider.sendBorrowTransaction(
            borrowTransaction,
            borrowTransactionMeta
          )
        ).toBe("borrow-hash");

        expect(sendBorrowTransaction).toHaveBeenCalledWith(
          borrowTransaction,
          borrowTransactionMeta
        );
        expect(sendTransaction).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "rejects Borrow invocation when the live provider loses its Borrow capability",
    () =>
      Effect.gen(function* () {
        const provider = new ExternalProvider(
          makeProviderRef({
            signMessage: async () => "signed-message",
            switchChain: async () => undefined,
            sendTransaction: async () => "classic-hash",
          })
        );

        const error = yield* Effect.flip(
          provider.sendBorrowTransaction(
            borrowTransaction,
            borrowTransactionMeta
          )
        );

        expect(error).toBeInstanceOf(ExternalProviderError);
        expect((error as ExternalProviderError).message).toBe(
          "Borrow transaction capability is unavailable"
        );
      })
  );
});
