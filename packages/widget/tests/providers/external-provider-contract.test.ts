import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Schema } from "effect";
import type { RefObject } from "react";
import {
  ActionId as BorrowActionId,
  IntegrationId as BorrowIntegrationId,
  TransactionId as BorrowTransactionId,
} from "../../src/domain/borrow/ids";
import {
  ActionId,
  TransactionId,
  WalletAddress,
  YieldId,
} from "../../src/domain/identity/identifiers";
import type {
  SKBorrowTx,
  SKBorrowWallet,
  SKExternalProviders,
  SKTx,
} from "../../src/public-api/types";
import type { ExternalProviderSnapshot } from "../../src/services/config/external-provider-snapshot";
import {
  ExternalProvider,
  ExternalProviderError,
} from "../../src/services/wallet/external-provider";
import type {
  BorrowTransactionMeta,
  ClassicTransactionMeta,
} from "../../src/services/wallet/wallet-transactions";

const address = Schema.decodeSync(WalletAddress)(
  "0x0000000000000000000000000000000000000001"
);

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
  address,
  amount: "1",
  amountRaw: "1000000000",
  annotatedTransaction: null,
  gasEstimate: undefined,
  inputToken: undefined,
  providersDetails: [],
  rawArguments: null,
  structuredTransaction: null,
  txId: Schema.decodeSync(TransactionId)("transaction-id"),
  txType: "STAKE",
  yieldId: Schema.decodeSync(YieldId)("solana-sol-native-staking"),
} satisfies ClassicTransactionMeta;

const borrowTransactionMeta = {
  actionId: Schema.decodeSync(BorrowActionId)("borrow-action-id"),
  actionType: "borrow",
  address,
  integrationId: Schema.decodeSync(BorrowIntegrationId)("aave-v3"),
  rawArguments: {
    amount: "1",
    marketId: "aave-v3-ethereum-usdc",
  },
  txId: Schema.decodeSync(BorrowTransactionId)("borrow-transaction-id"),
  txType: "BORROW",
} satisfies BorrowTransactionMeta;

const makeProviderRef = (
  provider: SKExternalProviders["provider"]
): RefObject<ExternalProviderSnapshot> => ({
  current: {
    type: "generic",
    currentAddress: "solana-address",
    currentChain: 501,
    supportedChainIds: [501],
    provider,
    borrow: false,
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
    borrow: true,
    provider,
  },
});

describe("generic external provider callback contract", () => {
  it.effect("uses the live provider when a deferred operation starts", () =>
    Effect.gen(function* () {
      const oldWallet: SKBorrowWallet = {
        signMessage: async () => "old-message",
        signTypedData: async () => "old-typed",
        switchChain: async () => undefined,
        sendTransaction: async () => "old-transaction",
        sendBorrowTransaction: async () => ({ txHash: "old-borrow" }),
      };
      const ref = makeBorrowProviderRef(oldWallet);
      const provider = new ExternalProvider(ref);
      const send = provider.sendTransaction(transaction, transactionMeta);
      const borrow = provider.sendBorrowTransaction(
        borrowTransaction,
        borrowTransactionMeta
      );
      const sign = provider.signTypedData(typedData);
      ref.current = {
        ...ref.current,
        borrow: true,
        provider: {
          ...oldWallet,
          signTypedData: async () => "new-typed",
          sendTransaction: async () => "new-transaction",
          sendBorrowTransaction: async () => ({ txHash: "new-borrow" }),
        },
      };
      expect(yield* send).toBe("new-transaction");
      expect(yield* borrow).toBe("new-borrow");
      expect(yield* sign).toBe("new-typed");
    })
  );
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
        const sendBorrowTransaction = vi.fn(async () => ({
          txHash: "borrow-hash",
        }));
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
        const wallet: SKBorrowWallet = {
          signMessage: async () => "signed-message",
          switchChain: async () => undefined,
          sendTransaction: async () => "classic-hash",
          sendBorrowTransaction: vi.fn(async () => ({ txHash: "borrow-hash" })),
        };
        const ref = makeBorrowProviderRef(wallet);
        const provider = new ExternalProvider(ref);
        const pending = provider.sendBorrowTransaction(
          borrowTransaction,
          borrowTransactionMeta
        );
        ref.current = makeProviderRef(wallet).current;
        const error = yield* Effect.flip(pending);

        expect(error).toBeInstanceOf(ExternalProviderError);
        expect(wallet.sendBorrowTransaction).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "fails Borrow sends on host rejection or a result without a hash",
    () =>
      Effect.gen(function* () {
        const wallet = (
          sendBorrowTransaction: SKBorrowWallet["sendBorrowTransaction"]
        ): SKBorrowWallet => ({
          signMessage: async () => "signed-message",
          switchChain: async () => undefined,
          sendTransaction: async () => "classic-hash",
          sendBorrowTransaction,
        });
        const rejected = new ExternalProvider(
          makeBorrowProviderRef(
            wallet(async () => {
              throw new Error("Borrow blocked by host policy");
            })
          )
        );
        const malformed = new ExternalProvider(
          makeBorrowProviderRef(wallet(async () => ({ txHash: "" })))
        );

        const rejection = yield* Effect.flip(
          rejected.sendBorrowTransaction(
            borrowTransaction,
            borrowTransactionMeta
          )
        );
        expect(rejection.customMessage).toBe("Borrow blocked by host policy");

        const invalid = yield* Effect.flip(
          malformed.sendBorrowTransaction(
            borrowTransaction,
            borrowTransactionMeta
          )
        );
        expect(invalid).toBeInstanceOf(ExternalProviderError);
        expect(invalid.message).toBe("Invalid Borrow transaction result");
      })
  );
});
